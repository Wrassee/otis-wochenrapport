# ===== Build Stage =====
FROM python:3.12-slim AS builder

WORKDIR /app

# Install build dependencies if needed (none for this project)
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ===== Runtime Stage =====
FROM python:3.12-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /root/.local /root/.local

# Ensure local binaries are in PATH
ENV PATH=/root/.local/bin:$PATH

# Copy application code
COPY src/ ./src/
COPY templates/ ./templates/

# Default environment variables
ENV PORT=8000
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

# Run with uvicorn (no --reload in production)
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
