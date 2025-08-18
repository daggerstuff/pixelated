# Alternative: Use Grafana's built-in alerting instead of Alertmanager
# This Dockerfile creates a simple webhook receiver for alerts

FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
RUN apk add --no-cache curl

# Create a simple alert webhook receiver
COPY package.json ./
RUN npm install express body-parser axios

# Copy the alert receiver script
COPY alert-receiver.js ./

# Create non-root user
RUN addgroup -g 1001 -S alertuser && \
    adduser -S alertuser -u 1001

USER alertuser

EXPOSE 9093

CMD ["node", "alert-receiver.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget --spider -q http://localhost:9093/ || exit 1
