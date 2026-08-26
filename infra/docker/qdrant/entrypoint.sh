#!/usr/bin/env sh
set -e

# Entry point runs as root inside the image. Ensure storage is present and writable
STORAGE_DIR="/qdrant/storage"
if [ -d "$STORAGE_DIR" ]; then
  echo "Initializing storage permissions on $STORAGE_DIR"
  chown -R 1000:1000 "$STORAGE_DIR" || true
  chmod -R u+rwX "$STORAGE_DIR" || true
else
  echo "Creating storage directory $STORAGE_DIR"
  mkdir -p "$STORAGE_DIR"
  chown -R 1000:1000 "$STORAGE_DIR" || true
  chmod -R u+rwX "$STORAGE_DIR" || true
fi

# Use gosu to drop privileges to UID 1000 and run the provided command (or qdrant binary)
if [ "$#" -eq 0 ]; then
  set -- /qdrant/qdrant
fi

echo "Switching to UID 1000 and executing: $@"
exec gosu 1000:0 "$@"
