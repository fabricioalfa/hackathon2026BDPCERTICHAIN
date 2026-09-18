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
import hashlib
import io
import json
import os
import re
import threading
import uuid

import cv2
import numpy as np
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract
import fitz  # PyMuPDF: renderiza PDF a imagen para OCR

app = FastAPI(title="CERTICHAIN OCR", version="2.0.1")

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
    "SERVICIO", "GENERAL", "IDENTIFICACION", "PERSONAL", "PERSONA", "SERIE", "SECCION",
}

# Etiquetas de campo: el valor de un campo termina cuando aparece una de ellas
FIELD_LABELS = {
    "NOMBRE", "NOMBRES", "APELLIDO", "APELLIDOS", "FECHA", "LUGAR", "SEXO",
    "DOMICILIO", "OCUPACION", "SERIE", "SECCION", "NACIMIENTO", "EMISION",
    "EXPEDIDO", "VENCE", "VALIDEZ",
}

# Palabras clave que delatan texto de un carnet (para puntuar candidatos OCR)
KEYWORDS = {
    "CARNET", "IDENTIDAD", "NOMBRES", "APELLIDOS", "NACIMIENTO", "FECHA",
    "LUGAR", "SEXO", "DOMICILIO", "EXPEDIDO", "VENCE", "CI", "NRO",
}

# Puntaje a partir del cual se considera una lectura suficientemente buena
HIGH_CONF_SCORE = 100

# ---------------------------------------------------------------------------
# Cache por hash de contenido (evita re-OCR de archivos repetidos)
# ---------------------------------------------------------------------------

_cache_lock = threading.Lock()
_cache = {}  # sha256 hex -> (texto_mostrable, pool_texto)


def _cache_key(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _cache_get(key: str) -> tuple[str, str] | None:
    with _cache_lock:
        return _cache.get(key)


def _cache_set(key: str, text: str, pool: str) -> None:
    with _cache_lock:
        _cache[key] = (text, pool)


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


def _pool_complete(pool_text: str) -> bool:
    """True si el pool ya contiene los 3 campos con alta fiabilidad.

    Usa comprobaciones estrictas (etiquetas explicitas) para no detenernos
    con falsos positivos tipicos del ruido OCR:
      - DNI: vía "C.I." / "Nº" / MRZ (no numeros sueltos).
      - Nombre: linea "A: X Y" / "N: X Y" / NOMBRES/APELLIDOS.
      - Fecha: con etiqueta de nacimiento.
    """
    _dni = re.search(
        r"(?<![A-ZÁÉÍÓÚÑ0-9])(?:C\s*[.:\-]?\s*[Il]\s*[.:\-]?"
        r"|CARNET(?:\s+DE\s+IDENTIDAD)?)\s*[:.\-–]?\s*(\d{5,8})\b",
        pool_text.upper(),
    ) or re.search(
        r"\bN\s*(?:RO|º|°|ª|o|O|0|I|l|5|\*|\"|´|`|')?\.?\s*[:.\-–]?\s*(\d{5,8})\b",
        pool_text.upper(),
    ) or re.search(
        r"[A-Z0-9]<[A-Z0-9]{2,3}(\d{6,8})<", pool_text.upper()
    )
    if not _dni:
        return False

    name_ok = bool(
        _first_capture(pool_text, r"NOMBRES?\s*[:.\-–]?\s*(.+)", ("NOMBRES",))
        or _first_capture(pool_text, r"APELLIDOS?\s*[:.\-–]?\s*(.+)", ("APELLIDOS",))
        or _first_capture(pool_text, r"(?m)^[^\S\n]*N[^\S\n]*[:.][^\S\n]*(.+)", ("NOMBRES",), allow_multiline=False)
        or _first_capture(pool_text, r"(?m)^[^\S\n]*A[^\S\n]*[:.][^\S\n]*(.+)", ("APELLIDOS",), allow_multiline=False)
    )
    if not name_ok:
        return False

    birth_ok = bool(
        re.search(
            r"(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|F\.?\s*NAC)[^0-9]{0,20}"
            r"(\b(?:0?[1-9]|[12]\d|3[01])\s*[/\-.]\s*(?:0?[1-9]|1[0-2])\s*[/\-.]\s*\d{2,4}\b)",
            pool_text.upper(),
            re.IGNORECASE,
        )
        or re.search(
            r"(?:NACIDO\s*(?:EL)?|NACIMIENTO|F\.?\s*NAC)"
            r"[^A-ZÁÉÍÓÚÑ0-9]{0,12}"
            r"(\d{1,2})\s*(?:DE\s+)?([A-ZÁÉÍÓÚÑ]+)\s*(?:DE\s*)?(\d{2,4})\b",
            pool_text.upper(),
            re.IGNORECASE,
        )
    )
    return birth_ok


def _ocr_variants(image_bytes: bytes, seed_pool: list[str] | None = None) -> tuple[str, str]:
    """Intenta varias configuraciones.

    Devuelve (mejor_texto, pool_texto). El pool es la union de todas las
    variantes (lineas unicas, en orden): permite que la extraccion de campos
    encuentre datos que una sola lectura pierde (p. ej. el numero del frente
    mientras que otra variante capturo bien el nombre y la fecha).

    Early-stop: en cuanto el pool acumulado ya permite detectar los 3 campos
    con fiabilidad, se deja de probar variantes (acelera PDFs de 2+ paginas).

    seed_pool: lineas de paginas anteriores ya combinadas en el pool, para
    que una pagina posterior detenga su OCR cuando solo le falte aportar
    nombre y fecha (el DNI ya vendria del frente).
    """
    bgr = _load_bgr(image_bytes)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    processed = _preprocess(gray)

    attempts = [
        ("color/psm3", bgr, "3"),
        ("gray/psm3", gray, "3"),
        ("gray/psm6", gray, "6"),
        ("gray/psm11", gray, "11"),
        ("bin/psm3", processed, "3"),
        ("bin/psm6", processed, "6"),
        # PSM 11 (sparse text) suele capturar mejor los numeros de carnet
        # que en PSM6 quedan separados ("No." y el numero en otra linea).
        ("bin/psm11", processed, "11"),
    ]

    best_text, best_score = "", 0.0
    pool_lines: list[str] = list(seed_pool or [])
    seen: set[str] = set(pool_lines)
    for _name, img, psm in attempts:
        try:
            text, score = _ocr_quality(img, psm)
        except pytesseract.TesseractError:
            continue
        if score > best_score:
            best_score = score
            best_text = text
        added = False
        for line in text.splitlines():
            line = line.strip()
            if not line or line in seen:
                continue
            seen.add(line)
            pool_lines.append(line)
            added = True
        if added and _pool_complete("\n".join(pool_lines)):
            break
    return best_text.strip(), "\n".join(pool_lines)


def extract_text(image_bytes: bytes) -> tuple[str, str]:
    """Extrae texto de bytes de imagen o PDF.

    Devuelve (texto_mostrable, pool_texto). El pool agrupa las lineas de
    todas las variantes OCR para que la extraccion de campos sea robusta.

    Memoiza por hash del contenido: archivos repetidos responden al instante.
    """
    key = _cache_key(image_bytes)
    cached = _cache_get(key)
    if cached:
        return cached
    if _looks_like_pdf(image_bytes):
        text, pool = _extract_pdf_text(image_bytes)
    else:
        text, pool = _ocr_variants(image_bytes)
    _cache_set(key, text, pool)
    return text, pool


def _looks_like_pdf(data: bytes) -> bool:
    """Detector por magic bytes: '%PDF' al inicio o cabecera en los primeros 1KB."""
    if data[:4] == b"%PDF":
        return True
    head = data[:1024].upper()
    return b"%PDF-" in head


# Magic bytes de cabecera por tipo de imagen (signature -> (ext, content-type))
_IMAGE_MAGIC = (
    (b"\xff\xd8\xff", "jpg", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "png", "image/png"),
    (b"GIF87a", "gif", "image/gif"),
    (b"GIF89a", "gif", "image/gif"),
    (b"BM", "bmp", "image/bmp"),
    (b"II*\x00", "tiff", "image/tiff"),
    (b"MM\x00*", "tiff", "image/tiff"),
    (b"RIFF", "webp", "image/webp"),
)


def _looks_like_image(data: bytes) -> bool:
    """Detecta si los bytes corresponden a una imagen por su cabecera."""
    return any(data.startswith(sig) for sig, _ext, _ct in _IMAGE_MAGIC)


def _pdf_to_images(pdf_bytes: bytes, max_pages: int = 3, dpi: int = 300) -> list[bytes]:
    """Renderiza las primeras paginas del PDF a PNG (bytes) para el OCR."""
    images: list[bytes] = []
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        for page in doc:
            if len(images) >= max_pages:
                break
            pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72))
            png = pix.tobytes("png")
            if png:
                images.append(png)
    finally:
        doc.close()
    return images


def _extract_pdf_text(pdf_bytes: bytes) -> tuple[str, str]:
    """Extrae texto de un PDF: renderiza cada pagina a alta resolucion y hace OCR.

    Devuelve (texto_mostrable, pool_texto) acumulando por pagina.

    Early-stop por pagina: si tras una pagina el pool ya permite detectar
    los 3 campos, no se sigue procesando (muy util en carnets de 2+ paginas
    donde el frente aporta el CI y el reverso nombre/fecha).
    """
    display: list[str] = []
    pool: list[str] = []
    seen: set[str] = set()
    for page_png in _pdf_to_images(pdf_bytes):
        try:
            best, page_pool = _ocr_variants(page_png, seed_pool=pool)
        except Exception:
            continue
        if best:
            display.append(best)
        added = False
        for line in page_pool.splitlines():
            if not line or line in seen:
                continue
            seen.add(line)
            pool.append(line)
            added = True
        if added and _pool_complete("\n".join(pool)):
            break
    return "\n".join(display).strip(), "\n".join(pool)


# ---------------------------------------------------------------------------
# Extracción de campos del carnet
# ---------------------------------------------------------------------------

_DATE_PATTERNS = [
    r"\b(0?[1-9]|[12]\d|3[01])\s*[/\-.]\s*(0?[1-9]|1[0-2])\s*[/\-.]\s*(\d{2,4})\b",
]

_SPANISH_MONTHS = {
    "ENERO": "01", "FEBRERO": "02", "MARZO": "03", "ABRIL": "04",
    "MAYO": "05", "JUNIO": "06", "JULIO": "07", "AGOSTO": "08",
    "SEPTIEMBRE": "09", "SETIEMBRE": "09", "OCTUBRE": "10",
    "NOVIEMBRE": "11", "DICIEMBRE": "12",
}

# "5 de Marzo de 2002" | "5 Marzo 2002" | "MARZO 5, 2002"
_TEXT_DATE_RE = re.compile(
    r"\b(\d{1,2})\s*(?:de\s+)?([A-ZÁÉÍÓÚÑ]+)\s*(?:de\s*,\s*)?\s*(\d{2,4})\b",
    re.IGNORECASE,
)


def _mask_dates(text: str) -> str:
    """Reemplaza fechas por marcadores para no confundirlas con un CI."""
    masked = text
    for pattern in _DATE_PATTERNS:
        masked = re.sub(pattern, lambda m: "DATE" * 5, masked)
    return masked


def normalize_dni(text: str) -> str | None:
    """Busca el nro de carnet/CI (5-8 digitos, opcional extension como LP/CH/TJ).

    Tolerante al texto tal como lo lee Tesseract: la etiqueta puede aparecer
    como "CI", "C.I.", "C.l.", "Cl", "CARNET DE IDENTIDAD" o "N + ordinal"
    ("Nº", "N°", "No.", "N0", "N5", "NRO").
    """
    masked = _mask_dates(text)
    uppercase = masked.upper()

    # 1) Deteccion por etiqueta explicita del numero de carnet.
    #    El lookbehind exige que la "C" no sea parte de otra palabra
    #    (evita, p. ej., comer la "C" final de "PLURINACN" + el "1" inicial).
    labeled = re.search(
        r"(?<![A-ZÁÉÍÓÚÑ0-9])(?:C\s*[.:\-]?\s*[Il]\s*[.:\-]?"
        r"|CARNET(?:\s+DE\s+IDENTIDAD)?)\s*[:.\-–]?\s*(\d{5,8})\b",
        uppercase,
    )
    if labeled:
        return labeled.group(1).strip()

    ordinal = re.search(
        r"\bN\s*(?:RO|º|°|ª|o|O|0|I|l|5|\*|\"|´|`|')?\.?\s*[:.\-–]?\s*(\d{5,8})\b",
        uppercase,
    )
    if ordinal:
        return ordinal.group(1).strip()

    # 2) Zona MRZ (maquina legible): nro de documento tras el codigo de pais.
    #    Ejemplo tipico del carnet boliviano: "1<B0L9903162<<4<<<<<<<<<<<<<<<"
    mrz = re.search(r"[A-Z0-9]<[A-Z0-9]{2,3}(\d{6,8})<", uppercase)
    if mrz:
        return mrz.group(1).strip()

    # 2) Con extension explícita:  "1234567 L.P." | "1234567-LP" | "123456789"
    with_extension = re.search(
        r"\b(\d{5,8})\s*[-\s.]?\s*([A-ZÁÉÍÓÚÑ]{1,3})(?:\.|\s|$)",
        uppercase,
    )
    if with_extension:
        return with_extension.group(1).strip()

    # 3) Numeros sueltos de 6-8 digitos (el mas largo suele ser el carnet)
    numbers = re.findall(r"\b(\d{6,8})\b", masked)
    if not numbers:
        numbers = re.findall(r"\b(\d{5,8})\b", masked)
    if numbers:
        return max(numbers, key=len).strip()
    return None


def _text_date_to_iso(raw_day: str, raw_month: str, raw_year: str) -> str | None:
    """Convierte '5', 'MARZO', '2002' -> '05/03/2002'."""
    month_num = _SPANISH_MONTHS.get(raw_month.upper())
    if not month_num:
        return None
    day = raw_day.zfill(2)
    year = raw_year
    if len(year) == 2:
        year = ("19" if int(year) >= 30 else "20") + year
    return f"{day}/{month_num}/{year}"


def normalize_date_of_birth(text: str) -> str | None:
    """Busca la fecha de nacimiento: 'FECHA DE NACIMIENTO ... 15/03/1990',
    'Nacido el 5 de Marzo de 2002' o cualquier fecha numerica/textual."""
    uppercase = text.upper()
    # 1) Patron con etiqueta de nacimiento (numerica)
    labeled = re.search(
        r"(?:FECHA\s*DE\s*NACIMIENTO|NACIMIENTO|F\.?\s*NAC)[^0-9]{0,20}"
        r"(\b(?:0?[1-9]|[12]\d|3[01])\s*[/\-.]\s*(?:0?[1-9]|1[0-2])\s*[/\-.]\s*\d{2,4}\b)",
        uppercase,
        re.IGNORECASE,
    )
    if labeled:
        return _format_date(label_group(labeled))

    # 1b) Patron textual con etiqueta de nacimiento: "Nacido el 5 de Marzo de 2002"
    labeled_text = re.search(
        r"(?:NACIDO\s*(?:EL)?|NACIMIENTO|F\.?\s*NAC)"
        r"[^A-ZÁÉÍÓÚÑ0-9]{0,12}"
        r"(\d{1,2})\s*(?:DE\s+)?([A-ZÁÉÍÓÚÑ]+)\s*(?:DE\s*)?(\d{2,4})\b",
        uppercase,
        re.IGNORECASE,
    )
    if labeled_text:
        iso = _text_date_to_iso(labeled_text.group(1), labeled_text.group(2), labeled_text.group(3))
        if iso:
            return iso

    # 2) Cualquier fecha numerica dd/mm/yyyy (o dd/mm/yy) encontrada
    for pattern in [r"\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{4}\b",
                    r"\b\d{1,2}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{2}\b"]:
        match = re.search(pattern, uppercase)
        if match:
            return _format_date(match.group(0))

    # 3) Cualquier fecha textual dd de MMMMM de yyyy
    for m in _TEXT_DATE_RE.finditer(uppercase):
        iso = _text_date_to_iso(m.group(1), m.group(2), m.group(3))
        if iso:
            return iso
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


def _first_capture(text: str, pattern: str, label_words: tuple[str, ...], allow_multiline: bool = True) -> str | None:
    """Captura el texto que sigue a una etiqueta (NOMBRES / APELLIDOS / ...).

    Los escaners suelen romper el valor en la/s linea/s siguiente/s a la
    etiqueta (p. ej. "NOMBRES:\\nRAFAEL FABRICIO"). Por eso, si la misma
    linea queda vacia, se intenta capturar el valor de las lineas que
    continuan hasta la proxima etiqueta conocida.

    allow_multiline=False para etiquetas cortas ("A:", "N:") de carnets
    antiguos, cuyo valor siempre va en la misma linea: asi no se mezclan con
    lineas de ruido vecinas del OCR.
    """
    match = re.search(pattern, text, re.IGNORECASE)
    if not match:
        return None
    value = re.sub(r"^[\s:\-–]+", "", match.group(1)).strip()

    # Etiqueta sin valor legible, o con ruido muy corto (1-2 chars tipico
    # de OCR que pone basura junto a la etiqueta) -> tomar lineas siguientes
    alpha_len = len(re.findall(r"[A-ZÁÉÍÓÚÑÇÜ]+", value.upper()))
    if allow_multiline and (alpha_len == 0 or (alpha_len <= 1 and len(value) <= 4)):
        rest = text[match.end():]
        lines = [ln.strip() for ln in rest.splitlines() if ln.strip()]
        collected = []
        for line in lines:
            tokens = line.replace("|", "I").replace("<", " ").split()
            stop = False
            for token in tokens:
                word = token.strip(".:,;'\"*=-¡!¿?«»`´<>").upper()
                if not word or len(word) < 3 or not re.match(r"^[A-ZÁÉÍÓÚÑÇÜ]+$", word):
                    continue
                if word in NOISE_WORDS or word in FIELD_LABELS:
                    stop = True
                    break
                collected.append(word)
            if stop:
                break
            if len(collected) >= 4:
                break
        value = " ".join(collected)

    # Etiquetas cortas ("A:", "N:"): exige un nombre real de 2+ palabras
    # en la misma linea para no capturar lineas de ruido tipo "a. el".
    # Si la coincidencia no es valida, sigue probando las siguientes.
    if not allow_multiline:
        for _re_match in re.finditer(pattern, text, re.IGNORECASE):
            val = re.sub(r"^[\s:\-–]+", "", _re_match.group(1)).strip()
            words = re.split(r"\s+", val)
            clean = []
            for w in words:
                if w.upper().rstrip(":") in NOISE_WORDS - set(label_words):
                    break
                clean.append(w)
            result = _clean_capture(" ".join(clean))
            if result and len(result.split()) >= 2:
                return result
        return None

    # Corta en la siguiente etiqueta conocida (para no mezclar campos)
    words = re.split(r"\s+", value)
    clean = []
    for word in words:
        if word.upper().rstrip(":") in NOISE_WORDS - set(label_words):
            break
        clean.append(word)
    result = _clean_capture(" ".join(clean))
    return result


def normalize_name(text: str) -> str | None:
    """Componer el nombre completo usando NOMBRES y APELLIDOS.

    Soporta carnets nuevos ("NOMBRES:/NOMBRE:", "APELLIDOS:/APELLIDO:") y
    carnets antiguos que abrevian la etiqueta como "A:" (apellidos) y
    "N:" (nombres) al inicio de linea.
    """
    nombres = _first_capture(text, r"NOMBRES?\s*[:.\-–]?\s*(.+)", ("NOMBRES",))
    apellidos = _first_capture(text, r"APELLIDOS?\s*[:.\-–]?\s*(.+)", ("APELLIDOS",))

    if not (nombres or apellidos):
        n_val = _first_capture(text, r"(?m)^[^\S\n]*N[^\S\n]*[:.][^\S\n]*(.+)", ("NOMBRES",), allow_multiline=False)
        a_val = _first_capture(text, r"(?m)^[^\S\n]*A[^\S\n]*[:.][^\S\n]*(.+)", ("APELLIDOS",), allow_multiline=False)
        nombres = n_val
        apellidos = a_val

    if nombres or apellidos:
        first = re.sub(r"^(?:NOMBRES?|N)[:.\-–\s]*", "", (nombres or "")).strip()
        last = re.sub(r"^(?:APELLIDOS?|A)[:.\-–\s]*", "", (apellidos or "")).strip()
        full = " ".join(p for p in (first, last) if p).strip()
        # Descarta tokens de ruido demasiado cortos (2 letras, tipico "ES" del OCR)
        full = " ".join(w for w in full.split() if len(w) >= 3)
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
    """Recibe una imagen o PDF y devuelve el texto extraido + campos detectados."""
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Archivo vacio")

    # Valida por magic bytes (mas fiable que el Content-Type del cliente)
    if not (_looks_like_pdf(content) or _looks_like_image(content) or file.content_type in ALLOWED_TYPES):
        raise HTTPException(status_code=415, detail="Tipo de archivo no soportado")

    try:
        text, pool_text = extract_text(content)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {exc}")

    lines = [line.strip() for line in text.splitlines() if line.strip()]

    return {
        "requestId": str(uuid.uuid4()),
        "filename": file.filename,
        "language": OCR_LANG,
        "text": text,
        "lines": lines,
        **extract_fields(pool_text),
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
        _text, pool_text = extract_text(image_bytes)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error procesando imagen: {exc}")

    return {
        "requestId": str(uuid.uuid4()),
        "language": OCR_LANG,
        "text": _text,
        **extract_fields(pool_text),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("OCR_PORT", "8090")))