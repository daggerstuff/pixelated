FROM traefik:v3.2

# Copy configuration files
COPY docker/traefik/traefik.yml /etc/traefik/traefik.yml
COPY docker/traefik/dynamic.yml /etc/traefik/dynamic/dynamic.yml

# Create Let's Encrypt directory
RUN mkdir -p /letsencrypt && chmod 600 /letsencrypt

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD traefik healthcheck --ping || exit 1

EXPOSE 80 443 8082

ENTRYPOINT ["traefik"]
