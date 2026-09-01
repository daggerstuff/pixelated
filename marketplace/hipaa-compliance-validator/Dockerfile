FROM python:3.12-slim

WORKDIR /app

RUN mkdir -p /app/data

COPY pyproject.toml .
COPY app/ ./app/
RUN pip install --no-cache-dir .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
