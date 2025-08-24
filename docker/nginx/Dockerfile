FROM nginx:alpine

# Copy custom nginx configuration
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf

# Create SSL directory
RUN mkdir -p /etc/nginx/ssl

# Copy SSL certificates (if available)
COPY docker/nginx/ssl/ /etc/nginx/ssl/

# Create log directories
RUN mkdir -p /var/log/nginx

EXPOSE 80 443

# Add a dedicated non-root user, fix ownership for NGINX directories
RUN adduser -D -g '' nginxuser && \
    chown -R nginxuser /etc/nginx /var/log/nginx /etc/nginx/ssl

USER nginxuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD curl --fail http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
