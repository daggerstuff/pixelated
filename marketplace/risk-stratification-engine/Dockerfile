FROM python:3.12-slim

WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY app/ ./app/

# Install the package
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
