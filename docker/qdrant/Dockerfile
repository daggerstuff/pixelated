FROM qdrant/qdrant:v1.9.0

# Install curl and gosu as root, then switch back to the image user
USER root
RUN set -eux \
  && apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates gnupg2 dirmngr \
  && apt-get install -y --no-install-recommends gosu \
  && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh


# Keep the container running entrypoint as root so it can fix volume permissions,
# then the entrypoint will use gosu to drop privileges to UID 1000 when executing qdrant.
USER root
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/qdrant/qdrant"]

# Health check for Qdrant service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:6333/health || exit 1

# Ensure last USER is not root
USER 1000
