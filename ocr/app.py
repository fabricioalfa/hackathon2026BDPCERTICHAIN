"""CERTICHAIN BDP - Microservicio OCR.

API REST que usa Tesseract (pytesseract) para extraer texto
de imagenes de carnets/folios/documentos.

Endpoints:
  POST /api/ocr/extract  -> sube una imagen, devuelve el texto extraido
  GET  /api/ocr/health   -> estado del servicio
"""

import base64
import io
import os
import re
import tempfile
import uuid

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import pytesseract

app = FastAPI(title="CERTICHAIN OCR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

OCR_LANG = os.getenv("OCR_LANG", "spa")

ALLOWED_TYPES = {"image/png", "image/jpeg", "image/webp", "image/bmp", "image/tiff"}


def extract_text(image_bytes: bytes) -> str:
    """Extrae texto de bytes de imagen usando Tesseract."""
    image = Image.open(io.BytesIO(image_bytes))
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")
    return pytesseract.image_to_string(image, lang=OCR_LANG)


def normalize_dni(text: str) -> str | None:
    """Busca un patron de CI/DNI en el texto (boliviano: 6-8 digitos, con/sin extension)."""
    patterns = [
        r"\b\d{6,8}\s*(?:-[a-zA-Z]{1,3})?\b",  # 1234567 o 1234567 -LP
    ]
    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).strip().replace(" ", "")
    return None


@app.get("/api/ocr/health")
def health():
    version = pytesseract.get_tesseract_version()
    return {"status": "ok", "tesseract": str(version)}


@app.post("/api/ocr/extract")
async def extract(file: UploadFile = File(...)):
    """Recibe una imagen y devuelve el texto extraido (crudo + normalizado)."""
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
        "detectedDni": normalize_dni(text),
    }


@app.post("/api/ocr/extract-base64")
async def extract_base64(request: Request):
    """Variante que acepta imagen en base64 (util para integracion con el backend)."""
    raw = await request.body()
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
        "detectedDni": normalize_dni(text),
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("OCR_PORT", "8090")))
