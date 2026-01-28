FROM python:3.11-slim

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY ai-services/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY ai-services/ ./
COPY ai-services/security/ ./security/

# Expose port
EXPOSE 5000

# Run the API server
CMD ["python", "api.py"]
