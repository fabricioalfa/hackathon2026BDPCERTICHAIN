"""CERTICHAIN BDP - Microservicio OCR.

API REST que usa Tesseract (pytesseract) para extraer datos de
fotocopias/escaneres de carnet de identidad (boliviano) y otros
documentos. Detecta principalmente:

  - Nro de carnet / CI        (detectedDni)
  - Nombre completo           (detectedName)
  - Fecha de nacimiento       (detectedDateOfBirth)

Se aplica preprocesamiento con OpenCV (blanco/negro, contraste,
escalado) para mejorar la lectura de fotocopias con ruido.

Endpoints:
  POST /api/ocr/extract        -> sube una imagen, devuelve texto + campos
  POST /api/ocr/extract-base64 -> variante que recibe imagen en base64
  GET  /api/ocr/health         -> estado del servicio
"""

import base64
import io
import os
import re
import uuid

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract

app = FastAPI(title="CERTICHAIN OCR", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OCR_LANG = os.getenv("OCR_LANG", "spa")

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff", "application/pdf"}

# Palabras que suelen aparecer en carnets y que no deben confundirse con un nombre
NOISE_WORDS = {
    "CARNET", "IDENTIDAD", "BOLIVIA", "REPUBLICA", "ESTADO", "PLURINACIONAL",
    "MINISTERIO", "GOBIERNO", "REGISTRO", "CIVIL", "CIVIC", "NOMBRES", "APELLIDOS",
    "NACIMIENTO", "FECHA", "LUGAR", "SEXO", "OCUPACION", "DOMICILIO", "VED",
    "FIRMA", "HUELLA", "DACTILAR", "OFICIAL", "REGISTRA", "EXTENSION", "NACIONALIDAD",
    "FOTOCOPIA", "VALIDO", "EXPEDIDO", "EMITIDO", "ELECTORAL", "ORGANO", "NUEVA",
}

# Palabras clave que delatan texto de un carnet (para puntuar candidatos OCR)
KEYWORDS = {
    "CARNET", "IDENTIDAD", "NOMBRES", "APELLIDOS", "NACIMIENTO", "FECHA",
    "LUGAR", "SEXO", "DOMICILIO", "EXPEDIDO", "VENCE", "CI", "NRO",
}

# Puntaje a partir del cual se considera una lectura suficientemente buena
HIGH_CONF_SCORE = 100


# ---------------------------------------------------------------------------
# Preprocesamiento de imagen
# ---------------------------------------------------------------------------

def _load_bgr(image_bytes: bytes) -> np.ndarray:
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)


def _preprocess(gray: np.ndarray) -> np.ndarray:
    """Escala + mejora de contraste + binarización para fotocopias."""
    h, w = gray.shape[:2]
    if w < 1400:
        scale = max(1400 / w, 2.0)
        gray = cv2.resize(gray, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    gray = cv2.medianBlur(gray, 3)
    contrast = cv2.convertScaleAbs(gray, alpha=1.4, beta=20)
    binary = cv2.adaptiveThreshold(
        contrast, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15
    )
    return binary


def _ocr_quality(img, psm: str) -> tuple[str, float]:
    """Corre Tesseract y devuelve (texto, calidad). La calidad combina la
    confianza media de las palabras con bonus por palabras clave de carnet
    y por digitos reconocidos (el nro de carnet)."""
    config = f"--psm {psm}"
    text = pytesseract.image_to_string(img, lang=OCR_LANG, config=config)
    try:
        data = pytesseract.image_to_data(img, lang=OCR_LANG, config=config, output_type=pytesseract.Output.DICT)
    except pytesseract.TesseractError:
        return text, 0.0

    words, confs, digits = [], [], 0
    for raw, conf_raw in zip(data.get("text", []), data.get("conf", [])):
        wt = re.sub(r"[^A-ZÁÉÍÓÚÑ0-9]", "", raw.strip().upper())
        if len(wt) >= 2:
            words.append(wt)
            confs.append(float(conf_raw) if conf_raw not in (None, "") else 0.0)
            digits += sum(1 for ch in wt if ch.isdigit())

    if not words:
        return text, 0.0

    mean_conf = sum(c for c in confs if c >= 0) / len(confs)
    has_letters = any(not w.isdigit() for w in words)
    keywords = len(set(words) & KEYWORDS)
    score = mean_conf * (1.0 if has_letters else 0.5) + keywords * 35 + min(digits, 40) * 0.5
    return text, score


def _ocr_variants(image_bytes: bytes) -> str:
    """Intenta varias configuraciones y devuelve el mejor texto (por calidad)."""
    bgr = _load_bgr(image_bytes)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    processed = _preprocess(gray)

    attempts = [
        ("color/psm3", bgr, "3"),
        ("gray/psm3", gray, "3"),
        ("bin/psm3", processed, "3"),
        ("bin/psm6", processed, "6"),
    ]

    best_text, best_score = "", 0.0
    for _name, img, psm in attempts:
        try:
            text, score = _ocr_quality(img, psm)
        except pytesseract.TesseractError:
            continue
        if score > best_score:
            best_score = score
            best_text = text
        # Confianza alta + keywords presentes: no vale la pena seguir probando
        if score >= HIGH_CONF_SCORE:
            break
    return best_text.strip()


def extract_text(image_bytes: bytes) -> str:
    """Extrae texto de bytes de imagen usando Tesseract (mejor intento)."""
    return _ocr_variants(image_bytes)


# ---------------------------------------------------------------------------
# Extracción de campos del carnet
# ---------------------------------------------------------------------------

_DATE_PATTERNS = [
    r"\b(0?[1-9]|[12]\d|3[01])\s*[/\-.]\s*(0?[1-9]|1[0-2])\s*[/\-.]\s*(\d{2,4})\b",
]


def _mask_dates(text: str) -> str:
    """Reemplaza fechas por marcadores para no confundirlas con un CI."""
    masked = text
    for pattern in _DATE_PATTERNS:
        masked = re.sub(pattern, lambda m: "DATE" * 5, masked)
    return masked


def normalize_dni(text: str) -> str | None:
    """Busca el nro de carnet/CI (5-8 digitos, opcional extension como LP/CH/TJ)."""
    masked = _mask_dates(text)
    uppercase = masked.upper()

    # 1) Con extension explícita:  "1234567 L.P." | "1234567-LP" | "123456789"
    with_extension = re.search(
        r"\b(\d{5,8})\s*[-\s.]?\s*([A-ZÁÉÍÓÚÑ]{1,3})(?:\.|\s|$)",
        uppercase,
    )
    if with_extension:
        return with_extension.group(1).strip()

    # 2) Numeros sueltos de 6-8 digitos (el mas largo suele ser el carnet)
    numbers = re.findall(r"\b(\d{6,8})\b", masked)
    if not numbers:
        numbers = re.findall(r"\b(\d{5,8})\b", masked)
    if numbers:
        return max(numbers, key=len).strip()
    return None


def normalize_date_of_birth(text: str) -> str | None:
    """Busca la fecha de nacimiento: 'FECHA DE NACIMIENTO ... 15/03/1990' o cualquier fecha."""
    uppercase = text.upper()
    # 1) Patron con etiqueta de nacimiento
    labeled = re.search(
        r"(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|F\.?\s*NAC)[^0-9]{0,20}"
        r"(\b(?:0?[1-9]|[12]\d|3[01])\s*[/\-.]\s*(?:0?[1-9]|1[0-2])\s*[/\-.]\s*\d{2,4}\b)",
        uppercase,
        re.IGNORECASE,
    )
    if labeled:
        return _format_date(label_group(labeled))

    # 2) Cualquier fecha dd/mm/yyyy (o dd/mm/yy) encontrada
    for pattern in [r"\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{4}\b",
                    r"\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2}\b"]:
        match = re.search(pattern, uppercase)
        if match:
            return _format_date(match.group(0))
    return None


def label_group(match: re.Match) -> str:
    """Devuelve el grupo capturado o todo el match."""
    return match.group(1) if match.lastindex else match.group(0)


def _format_date(raw: str) -> str:
    """Normaliza a dd/mm/yyyy (completa a 4 digitos de año)."""
    parts = re.split(r"[/\-. ]+", raw.strip())
    if len(parts) != 3:
        return raw.strip().replace(" ", "")
    day, month, year = parts
    day = day.zfill(2)
    month = month.zfill(2)
    if len(year) == 2:
        year = ("19" if int(year) >= 30 else "20") + year
    return f"{day}/{month}/{year}"


def _clean_capture(capture: str | None) -> str | None:
    if not capture:
        return None
    capture = re.sub(r"[|!]l", "l", capture)
    capture = re.sub(r"[^A-ZÁÉÍÓÚÑÇÜÀÂÃÕ .,-]", " ", capture.upper())
    capture = re.sub(r"\s+", " ", capture).strip(" .-")
    return capture or None


def _first_capture(text: str, pattern: str, label_words: tuple[str, ...]) -> str | None:
    """Captura el texto que sigue a una etiqueta (NOMBRES / APELLIDOS / ...)."""
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    value = re.sub(r"^[\s:\-–]+", "", match.group(1)).strip()
    # Corta en la siguiente etiqueta conocida (para no mezclar campos)
    words = re.split(r"\s+", value)
    clean = []
    for word in words:
        if word.upper().rstrip(":") in NOISE_WORDS - set(label_words):
            break
        clean.append(word)
    return _clean_capture(" ".join(clean))


def normalize_name(text: str) -> str | None:
    """Componer el nombre completo usando los campos NOMBRES y APELLIDOS (o la línea larga)."""
    nombres = _first_capture(text, r"NOMBRES?\s*[:.\-–]?\s*(.+)", ("NOMBRES",))
    apellidos = _first_capture(text, r"APELLIDOS?\s*[:.\-–]?\s*(.+)", ("APELLIDOS",))

    if nombres or apellidos:
        first = re.sub(r"^(NOMBRES|APELLIDOS)[:.\-–\s]*", "", (nombres or "")).strip()
        last = re.sub(r"^(NOMBRES|APELLIDOS)[:.\-–\s]*", "", (apellidos or "")).strip()
        full = " ".join(p for p in (first, last) if p).strip()
        return _clean_capture(full) if full else None

    # Fallback: línea con 2+ palabras en mayúsculas que no sea ruido
    for line in text.splitlines():
        cleaned = re.sub(r"[^A-ZÁÉÍÓÚÑÇÜ ]", " ", line.upper()).split()
        if len(cleaned) >= 2 and not any(w in NOISE_WORDS for w in cleaned):
            candidate = _clean_capture(" ".join(cleaned))
            if candidate:
                return candidate
    return None


def extract_fields(text: str) -> dict:
    """Devuelve los campos conocidos encontrados en el texto OCR."""
    found = {
        "detectedDni": normalize_dni(text),
        "detectedName": normalize_name(text),
        "detectedDateOfBirth": normalize_date_of_birth(text),
    }
    detected = sum(1 for v in found.values() if v)
    return {**found, "fieldsDetected": detected}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/ocr/health")
def health():
    version = pytesseract.get_tesseract_version()
    return {"status": "ok", "tesseract": str(version), "language": OCR_LANG}


@app.post("/api/ocr/extract")
async def extract(file: UploadFile = File(...)):
    """Recibe una imagen y devuelve el texto extraido + campos detectados."""
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Tipo de archivo no soportado")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Archivo vacio")

    try:
        text = extract_text(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {exc}")

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    return {
        "requestId": str(uuid.uuid4()),
        "filename": file.filename,
        "language": OCR_LANG,
        "text": text,
        "lines": lines,
        **extract_fields(text),
    }


@app.post("/api/ocr/extract-base64")
async def extract_base64(request: Request):
    """Variante que acepta imagen en base64 (util para integracion con el backend)."""
    payload = await request.json()
    encoded = payload.get("base64")
    if not encoded:
        raise HTTPException(status_code=400, detail="Campo 'base64' requerido")

    try:
        image_bytes = base64.b64decode(encoded)
        text = extract_text(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {exc}")

    return {
        "requestId": str(uuid.uuid4()),
        "language": OCR_LANG,
        "text": text,
        **extract_fields(text),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("OCR_PORT", "8090")))