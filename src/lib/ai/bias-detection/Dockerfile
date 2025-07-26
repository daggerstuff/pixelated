# Dockerfile for Bias Detection Service
FROM python:3.9-slim

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

# Command to run the service
COPY gunicorn_config.py .
CMD ["gunicorn", "-c", "gunicorn_config.py", "start-python-service:app"]

