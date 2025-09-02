# Dockerfile for pixelated-app-new (fixed for port alignment)
FROM node:24-alpine

LABEL org.opencontainers.image.authors="Vivi <vivi@pixelatedempathy.com>"
LABEL org.opencontainers.image.title="Pixelated Empathy Node"
LABEL org.opencontainers.image.description="Secure Node.js app using a minimal base image for reduced vulnerabilities."

# Application Healthcheck: verifies service health (only one HEALTHCHECK allowed per stage)
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js .
EXPOSE 4321
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4321/health || exit 1
CMD ["npm", "start"]
  