# Allow pinning the base image from CI (use a digest or specific tag for reproducible builds)
ARG BASE_IMAGE=google/cloud-sdk:slim
FROM ${BASE_IMAGE}

# It's recommended to set the build arg in CI to a specific tag or digest, for example:
# --build-arg BASE_IMAGE=google/cloud-sdk:436.0.0-slim

# Metadata for image scanners / catalogues
LABEL org.opencontainers.image.source="https://gitlab.com/pixeldeck/pixelated"
LABEL org.opencontainers.image.license="MIT"

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release apt-transport-https && \
    curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg && \
    echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" > /etc/apt/sources.list.d/kubernetes.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends kubectl && \
    # Avoid aggressive purging of packages gcloud may rely on; keep cleanup minimal to prevent
    # accidental removal of tools needed by gcloud components.
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Install gke-gcloud-auth-plugin (component installer will be idempotent)
RUN gcloud components install gke-gcloud-auth-plugin --quiet || true

# Add a non-root user for security
RUN useradd --no-log-init --system --home /home/cloudsdk --shell /bin/bash cloudsdk && \
    mkdir -p /home/cloudsdk && chown cloudsdk:cloudsdk /home/cloudsdk

USER cloudsdk

# Ensure gcloud bin is on PATH
ENV PATH="/google-cloud-sdk/bin:${PATH}"

CMD ["/bin/bash"]
