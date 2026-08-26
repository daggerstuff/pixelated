# Gunicorn configuration file for the Bias Detection Service

import os

# Bind to all interfaces on port 5001 by default, or use environment variables
bind = f"{os.getenv('BIAS_SERVICE_HOST', '0.0.0.0')}:{os.getenv('BIAS_SERVICE_PORT', '5001')}"

# Number of worker processes. A common recommendation is (2 * CPU_CORES) + 1.
# For simplicity, we'll start with 4 workers, but this should be tuned based on server resources.
workers = int(os.getenv("GUNICORN_WORKERS", "4"))

# Worker class. Gevent is recommended for I/O-bound applications like this Flask API.
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "gevent")

# Timeout for graceful workers shutdown.
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))

# Logging
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")
accesslog = os.getenv("GUNICORN_ACCESSLOG", "-")  # '-' means stdout
errorlog = os.getenv("GUNICORN_ERRORLOG", "-")  # '-' means stderr

# Process ID file
pidfile = os.getenv("GUNICORN_PIDFILE", "/tmp/bias-detection-service.pid")

# Daemonize the Gunicorn process (run in background)
# Set to False for foreground operation, useful for Docker or systemd
daemon = os.getenv("GUNICORN_DAEMON", "False").lower() == "true"

# Preload the application. This can save memory if workers share the same code,
# but can cause issues with some applications (e.g., those with global state).
# Set to False if issues arise.
preload_app = os.getenv("GUNICORN_PRELOAD_APP", "False").lower() == "true"

# WSGI application path
# Note: start-python-service.py imports the app from python-service/bias_detection_service.py
wsgi_app = "start-python-service:app"
