# GitLab Pipeline Monitoring and Alerting Configuration

## Pipeline Performance Metrics

### Key Performance Indicators (KPIs)

1. **Build Time**: Target < 8 minutes total pipeline time
2. **Success Rate**: Target > 95% pipeline success rate
3. **Security Scan Coverage**: 100% of builds scanned
4. **Deployment Frequency**: Track deployment cadence
5. **Mean Time to Recovery (MTTR)**: Target < 15 minutes

### Monitoring Setup

#### GitLab Built-in Monitoring

1. **Pipeline Analytics**
   - Go to Analytics → CI/CD Analytics
   - Monitor pipeline duration trends
   - Track success/failure rates
   - Identify bottlenecks

2. **Security Dashboard**
   - Go to Security & Compliance → Security Dashboard
   - Monitor vulnerability trends
   - Track security scan results
   - Review dependency scanning

3. **Container Registry**
   - Monitor image sizes
   - Track vulnerability scans
   - Review image usage

#### External Monitoring Integration

```yaml
# Add to .gitlab-ci.yml for external monitoring
monitoring:
  stage: deploy
  image: alpine:latest
  script:
    - |
      # Send metrics to external monitoring system
      curl -X POST "$MONITORING_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d '{
          "pipeline_id": "'$CI_PIPELINE_ID'",
          "project": "'$CI_PROJECT_NAME'",
          "branch": "'$CI_COMMIT_REF_NAME'",
          "status": "success",
          "duration": "'$CI_PIPELINE_DURATION'",
          "timestamp": "'$(date -Iseconds)'"
        }'
  rules:
    - if: $CI_COMMIT_BRANCH == "master"
    - if: $CI_COMMIT_BRANCH == "main"
  allow_failure: true
```

## Alerting Configuration

### GitLab Notifications

1. **Pipeline Failure Alerts**
   ```yaml
   # In .gitlab-ci.yml
   notify-failure:
     stage: .post
     image: alpine:latest
     script:
       - |
         if [ "$CI_PIPELINE_STATUS" = "failed" ]; then
           curl -X POST "$SLACK_WEBHOOK" \
             -H "Content-Type: application/json" \
             -d '{
               "text": "🚨 Pipeline Failed",
               "attachments": [{
                 "color": "danger",
                 "fields": [
                   {"title": "Project", "value": "'$CI_PROJECT_NAME'", "short": true},
                   {"title": "Branch", "value": "'$CI_COMMIT_REF_NAME'", "short": true},
                   {"title": "Commit", "value": "'$CI_COMMIT_SHORT_SHA'", "short": true},
                   {"title": "Pipeline", "value": "'$CI_PIPELINE_URL'", "short": false}
                 ]
               }]
             }'
         fi
     rules:
       - when: always
     allow_failure: true
   ```

2. **Security Alert Integration**
   ```yaml
   security-alert:
     stage: .post
     image: alpine:latest
     script:
       - |
         # Check for critical vulnerabilities
         if [ -f "gl-sast-report.json" ]; then
           CRITICAL_COUNT=$(jq '[.vulnerabilities[] | select(.severity == "Critical")] | length' gl-sast-report.json)
           if [ "$CRITICAL_COUNT" -gt 0 ]; then
             curl -X POST "$SECURITY_WEBHOOK" \
               -H "Content-Type: application/json" \
               -d '{
                 "alert": "Critical vulnerabilities found",
                 "count": '$CRITICAL_COUNT',
                 "project": "'$CI_PROJECT_NAME'",
                 "pipeline": "'$CI_PIPELINE_URL'"
               }'
           fi
         fi
     artifacts:
       reports:
         sast: gl-sast-report.json
     rules:
       - when: always
     allow_failure: true
   ```

### Health Check Monitoring

```bash
#!/bin/bash
# Health check monitoring script
# Add to your monitoring system

HEALTH_ENDPOINT="https://your-domain.com/api/health"
ALERT_WEBHOOK="$MONITORING_WEBHOOK"

check_health() {
    local response
    local status_code
    
    response=$(curl -s -w "%{http_code}" "$HEALTH_ENDPOINT" -o /tmp/health_response)
    status_code="${response: -3}"
    
    if [ "$status_code" -eq 200 ]; then
        # Parse health response
        local health_status
        health_status=$(jq -r '.status' /tmp/health_response 2>/dev/null || echo "unknown")
        
        if [ "$health_status" = "healthy" ]; then
            echo "✅ Health check passed"
            return 0
        else
            echo "❌ Health check failed: status=$health_status"
            send_alert "Health check failed" "Status: $health_status"
            return 1
        fi
    else
        echo "❌ Health endpoint returned $status_code"
        send_alert "Health endpoint error" "HTTP $status_code"
        return 1
    fi
}

send_alert() {
    local title="$1"
    local message="$2"
    
    curl -X POST "$ALERT_WEBHOOK" \
        -H "Content-Type: application/json" \
        -d '{
            "title": "'"$title"'",
            "message": "'"$message"'",
            "timestamp": "'"$(date -Iseconds)"'",
            "severity": "high"
        }' || echo "Failed to send alert"
}

# Run health check
check_health
```

## Performance Optimization Monitoring

### Resource Usage Tracking

```yaml
# Add to .gitlab-ci.yml for resource monitoring
resource-monitor:
  stage: .post
  image: alpine:latest
  script:
    - |
      # Collect resource usage metrics
      echo "Pipeline Resource Usage Report" > resource-report.txt
      echo "=============================" >> resource-report.txt
      echo "Pipeline ID: $CI_PIPELINE_ID" >> resource-report.txt
      echo "Duration: $CI_PIPELINE_DURATION seconds" >> resource-report.txt
      echo "Jobs: $(echo $CI_JOB_NAME | wc -w)" >> resource-report.txt
      echo "Timestamp: $(date)" >> resource-report.txt
      
      # Send to monitoring system
      if [ -n "$METRICS_ENDPOINT" ]; then
        curl -X POST "$METRICS_ENDPOINT" \
          -H "Content-Type: application/json" \
          -d '{
            "pipeline_id": "'$CI_PIPELINE_ID'",
            "duration": '$CI_PIPELINE_DURATION',
            "project": "'$CI_PROJECT_NAME'",
            "branch": "'$CI_COMMIT_REF_NAME'",
            "timestamp": "'$(date -Iseconds)'"
          }'
      fi
  artifacts:
    reports:
      performance: resource-report.txt
    expire_in: 1 week
  rules:
    - when: always
  allow_failure: true
```

### Build Cache Efficiency

```yaml
cache-metrics:
  stage: .post
  image: alpine:latest
  script:
    - |
      # Analyze cache efficiency
      if [ -d ".pnpm-store" ]; then
        CACHE_SIZE=$(du -sh .pnpm-store | cut -f1)
        echo "pnpm cache size: $CACHE_SIZE"
      fi
      
      if [ -d "node_modules" ]; then
        NODE_MODULES_SIZE=$(du -sh node_modules | cut -f1)
        echo "node_modules size: $NODE_MODULES_SIZE"
      fi
      
      # Calculate cache hit ratio (if available)
      if [ -f "pnpm-debug.log" ]; then
        CACHE_HITS=$(grep -c "cache hit" pnpm-debug.log || echo "0")
        CACHE_MISSES=$(grep -c "cache miss" pnpm-debug.log || echo "0")
        TOTAL=$((CACHE_HITS + CACHE_MISSES))
        
        if [ $TOTAL -gt 0 ]; then
          HIT_RATIO=$((CACHE_HITS * 100 / TOTAL))
          echo "Cache hit ratio: ${HIT_RATIO}%"
        fi
      fi
  rules:
    - when: always
  allow_failure: true
```

## Dashboard Configuration

### GitLab Project Dashboard

1. **Custom Dashboard Widgets**
   - Pipeline success rate
   - Average build time
   - Security vulnerability count
   - Deployment frequency

2. **Security Metrics**
   - Critical vulnerabilities over time
   - Dependency scan results
   - Container scan findings

### External Dashboard Integration

```json
{
  "dashboard": {
    "title": "Pixelated Empathy CI/CD Metrics",
    "panels": [
      {
        "title": "Pipeline Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "gitlab_pipeline_success_rate{project='pixelated'}",
            "legendFormat": "Success Rate"
          }
        ]
      },
      {
        "title": "Build Duration",
        "type": "graph",
        "targets": [
          {
            "expr": "gitlab_pipeline_duration{project='pixelated'}",
            "legendFormat": "Duration (seconds)"
          }
        ]
      },
      {
        "title": "Security Vulnerabilities",
        "type": "table",
        "targets": [
          {
            "expr": "gitlab_security_vulnerabilities{project='pixelated'}",
            "legendFormat": "{{severity}}"
          }
        ]
      }
    ]
  }
}
```

## Incident Response Procedures

### Pipeline Failure Response

1. **Immediate Actions**
   - Check pipeline logs for error details
   - Verify if it's a transient failure (retry)
   - Check external service status (Docker Hub, npm registry)

2. **Investigation Steps**
   - Review recent commits for breaking changes
   - Check resource usage and limits
   - Verify environment variables and secrets

3. **Resolution Actions**
   - Fix identified issues
   - Re-run pipeline
   - Update monitoring if needed

### Security Alert Response

1. **Critical Vulnerability Found**
   - Stop deployment pipeline
   - Assess vulnerability impact
   - Create security issue in GitLab
   - Plan remediation strategy

2. **Container Security Alert**
   - Review container scan results
   - Update base images if needed
   - Rebuild and redeploy

### Performance Degradation Response

1. **Build Time Increase**
   - Analyze resource usage
   - Check cache efficiency
   - Review recent changes
   - Optimize bottlenecks

2. **Deployment Issues**
   - Check health endpoints
   - Review container logs
   - Verify resource availability
   - Consider rollback if needed

## Maintenance Tasks

### Weekly Tasks
- [ ] Review pipeline performance metrics
- [ ] Check security scan results
- [ ] Update dependencies if needed
- [ ] Clean up old artifacts and images

### Monthly Tasks
- [ ] Analyze pipeline trends
- [ ] Review and update alerting rules
- [ ] Optimize resource usage
- [ ] Update monitoring dashboards

### Quarterly Tasks
- [ ] Security audit of pipeline configuration
- [ ] Performance optimization review
- [ ] Update monitoring and alerting strategy
- [ ] Review incident response procedures