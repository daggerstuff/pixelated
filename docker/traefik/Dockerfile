FROM traefik:v3.2

# Copy configuration files
COPY docker/traefik/traefik.yml /etc/traefik/traefik.yml
COPY docker/traefik/dynamic.yml /etc/traefik/dynamic/dynamic.yml

# Harden runtime by running as non-root while still binding privileged ports
RUN apk add --no-cache libcap \
    && addgroup -S traefik && adduser -S -G traefik traefik \
    && setcap 'cap_net_bind_service=+ep' /usr/local/bin/traefik \
    && mkdir -p /letsencrypt /var/run/traefik \
    && chmod 700 /letsencrypt \
    && chown -R traefik:traefik /letsencrypt /etc/traefik /var/run/traefik

USER traefik

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD traefik healthcheck --ping || exit 1

EXPOSE 80 443 8082

ENTRYPOINT ["traefik"]
