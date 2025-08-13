# Use the latest version which may have security fixes
FROM prom/alertmanager:v0.28.0-rc.0 AS alertmanager

# Use a minimal, secure base image
FROM alpine:3.19

# Install only essential packages and clean up
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 65534 -S alertmanager && \
    adduser -u 65534 -S -G alertmanager alertmanager

# Copy the alertmanager binary and configuration
COPY --from=alertmanager /bin/alertmanager /bin/alertmanager
COPY --from=alertmanager /etc/alertmanager/alertmanager.yml /etc/alertmanager/alertmanager.yml.default
COPY alertmanager.yml /etc/alertmanager/alertmanager.yml

# Create data directory with proper permissions
RUN mkdir -p /alertmanager && \
    chown -R alertmanager:alertmanager /alertmanager /etc/alertmanager

USER alertmanager

EXPOSE 9093

ENTRYPOINT ["/bin/alertmanager"]
CMD ["--config.file=/etc/alertmanager/alertmanager.yml", "--storage.path=/alertmanager"]
