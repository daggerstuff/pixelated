#!/bin/bash

# Simple external uptime monitor
# Can run on any $5/month VPS or even a free tier service

ENDPOINTS=(
    "https://pixelatedempathy.com"
    "https://pixelatedempathy.com/api/health/simple"
    "https://pixelatedempathy.com/api/health"
)

SLACK_WEBHOOK="${SLACK_WEBHOOK_URL}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK_URL}"

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

send_alert() {
    local message="$1"
    local severity="$2"
    
    # Send to Slack
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK"
    fi
    
    # Send to Discord
    if [ -n "$DISCORD_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"content\":\"$message\"}" \
            "$DISCORD_WEBHOOK"
    fi
    
    # Log locally
    log_message "$message"
}

check_endpoint() {
    local url="$1"
    local max_time="${2:-10}"
    
    # Get HTTP status and response time
    local result=$(curl -w "%{http_code},%{time_total}" -s -o /dev/null --max-time "$max_time" "$url")
    local http_code=$(echo "$result" | cut -d',' -f1)
    local response_time=$(echo "$result" | cut -d',' -f2)
    
    if [ "$http_code" = "200" ]; then
        log_message "✅ $url - OK (${response_time}s)"
        return 0
    else
        log_message "❌ $url - FAILED (HTTP: $http_code, Time: ${response_time}s)"
        send_alert "🚨 ALERT: $url is DOWN (HTTP: $http_code)" "critical"
        return 1
    fi
}

main() {
    log_message "Starting health check cycle..."
    
    local failed_checks=0
    
    for endpoint in "${ENDPOINTS[@]}"; do
        if ! check_endpoint "$endpoint"; then
            ((failed_checks++))
        fi
        sleep 2  # Rate limiting
    done
    
    if [ $failed_checks -eq 0 ]; then
        log_message "All endpoints healthy ✅"
    else
        log_message "⚠️ $failed_checks endpoint(s) failed"
    fi
    
    log_message "Health check cycle completed"
}

# Run immediately
main

# If this script is set up as a cron job, it will exit here
# For continuous monitoring, uncomment the loop below:

# while true; do
#     main
#     sleep 300  # Check every 5 minutes
# done
