# ==============================================================================
# HealthSync AI — Production Backend Dockerfile
# Optimized for Render, Cloud Run, AWS ECS, or any container environment
# ==============================================================================

FROM python:3.12-slim

# Prevent Python from writing .pyc files & buffer output
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV TESSERACT_CMD="/usr/bin/tesseract"
ENV UPLOAD_DIR="/app/uploads"
ENV HOST="0.0.0.0"
ENV PORT="8000"

WORKDIR /app

# Install system dependencies including Tesseract OCR & required libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libgl1 \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Verify tesseract binary installation
RUN tesseract --version

# Copy requirements and install Python dependencies
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /app/backend/requirements.txt

# Copy application source code
COPY backend/ /app/backend/

# Copy canonical synthetic demo assets into persistent container uploads directory
COPY uploads/ /app/uploads/
RUN chmod -R 755 /app/uploads

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Production server start command
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
