# Minimal Python runtime — no C-ext deps needed (openpyxl removed)
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies (pure Python packages, no compilation needed)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && rm -rf /root/.cache/pip

# Copy application code only (not requirements.txt, not tests)
COPY src/ ./src/
COPY templates/ ./templates/

# Runtime configuration
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
