# Dockerfile for Bias Detection Service
FROM python:3.15-rc-alpine3.22

# Set working directory
WORKDIR /app

# Install system dependencies and curl for healthcheck
RUN apk add --no-cache \
    gcc \
    musl-dev \
    libffi-dev \
    openssl-dev \
    cargo \
    rust \
    curl \
    && rm -rf /var/cache/apk/*

# Install uv
RUN pip install --no-cache-dir uv

# Copy requirements and install dependencies
COPY requirements.txt .
RUN uv pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Download spaCy and NLTK models
RUN python -m spacy download en_core_web_sm && \
    python -m spacy download en_core_web_md && \
    python -c "import nltk; nltk.download('punkt'); nltk.download('stopwords'); nltk.download('wordnet'); nltk.download('vader_lexicon'); nltk.download('averaged_perceptron_tagger'); nltk.download('omw-1.4')"

# Expose port
EXPOSE 5001

# Set environment variables for the service
ENV BIAS_SERVICE_HOST=0.0.0.0
ENV BIAS_SERVICE_PORT=5001

# Create non-root user
RUN addgroup -S bias && adduser -S -G bias bias
USER bias

# Command to run the service
COPY gunicorn_config.py .
CMD ["gunicorn", "-c", "gunicorn_config.py", "start-python-service:app"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:5001/health || exit 1
