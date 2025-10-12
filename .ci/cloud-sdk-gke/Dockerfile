# Allow pinning the base image from CI (use a digest or specific tag for reproducible builds)
ARG BASE_IMAGE=google/cloud-sdk:slim
FROM ${BASE_IMAGE}

# It's recommended to set the build arg in CI to a specific tag or digest, for example:
# --build-arg BASE_IMAGE=google/cloud-sdk:436.0.0-slim

# Metadata for image scanners / catalogues
LABEL org.opencontainers.image.source="https://gitlab.com/pixeldeck/pixelated"
LABEL org.opencontainers.image.license="MIT"

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg lsb-release apt-transport-https jq && \
    curl -fsSL https://pkgs.k8s.io/core:/stable:/v1.30/deb/Release.key | gpg --dearmor -o /usr/share/keyrings/kubernetes-apt-keyring.gpg && \
    echo 'deb [signed-by=/usr/share/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v1.30/deb/ /' > /etc/apt/sources.list.d/kubernetes.list && \
    apt-get update && \
    apt-get install -y kubectl && \
    # Avoid aggressive purging of packages gcloud may rely on; keep cleanup minimal to prevent
    # accidental removal of tools needed by gcloud components.
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Install gke-gcloud-auth-plugin (the base image disables component management)
RUN apt-get update && \
    apt-get install -y google-cloud-cli-gke-gcloud-auth-plugin && \
    apt-get clean && rm -rf /var/lib/apt/lists/* /tmp/*

# Ensure the cloudsdk user's home directory exists and has correct permissions
RUN mkdir -p /home/cloudsdk && chown cloudsdk:cloudsdk /home/cloudsdk

USER cloudsdk

# Ensure gcloud bin is on PATH
ENV PATH="/google-cloud-sdk/bin:${PATH}"

CMD ["/bin/bash"]
