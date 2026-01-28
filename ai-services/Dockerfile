FROM python:3.11-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

# Install dependencies
COPY ai-services/requirements.txt ./
RUN uv pip install --no-cache --system -r requirements.txt --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple --index-strategy unsafe-best-match

# Copy application code
COPY ai-services/ ./
COPY ai-services/security/ ./security/

# Expose port
EXPOSE 5000

# Run the API server
CMD ["python", "api.py"]
