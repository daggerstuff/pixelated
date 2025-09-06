# Dockerfile for Bias Detection Service
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install uv
RUN pip install uv

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
RUN addgroup --system bias && adduser --system --ingroup bias bias
USER bias

# Command to run the service
COPY gunicorn_config.py .
CMD ["gunicorn", "-c", "gunicorn_config.py", "start-python-service:app"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:5001/health || exit 1
