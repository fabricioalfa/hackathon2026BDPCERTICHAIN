# Microservicio OCR con Tesseract
FROM python:3.12-slim

# Tesseract + idioma espanol
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-spa \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

ENV OCR_LANG=spa
ENV OCR_PORT=8090

EXPOSE 8090

CMD ["python", "app.py"]
