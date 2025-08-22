# Comprehensive Troubleshooting Guide
# ==================================
## Bias Detection Engine: Common Issues & Troubleshooting

### Configuration and Initialization Errors
- **Symptom:** "Invalid threshold configuration" or similar error on startup.
- **Diagnosis:** Check that `warningLevel < highLevel < criticalLevel` in your config. Review error messages for actual/expected values.
- **Solution:** Update your config to use valid, ascending threshold values.

### Engine Initialization Fails
- **Symptom:** Engine fails to initialize, hangs, or throws.
- **Diagnosis:** Ensure all required environment variables are set. Check for missing or invalid config fields.
- **Solution:** Run diagnostics (`pnpm run diagnostics`). Review `.env.local` and config files.

### Python Backend Service Issues
- **Symptom:** "Service unavailable", timeouts, or connection errors.
- **Diagnosis:** Ensure Python backend is running (`python bias_detection_service.py`). Check service URL and port.
- **Solution:** Restart the backend. Check logs for errors. Verify dependencies are installed (`pip install -r requirements.txt`).

### Test Failures (MSW, Mocking, Environment)
- **Symptom:** Tests fail with MSW import errors or mocking issues.
- **Diagnosis:** Check `vitest.config.ts` for correct MSW alias (`msw/node` → `msw/lib/node/index.js`).
- **Solution:** Update config, reinstall dependencies, and retry.

### Linting and Type Checking
- **Symptom:** Linter/type errors, unused variable warnings, or property access issues.
- **Diagnosis:** Run `pnpm lint` and `pnpm typecheck`. Review error output for details.
- **Solution:** Fix unused variables, use correct property access (dot vs. bracket), and update type definitions as needed.

### Error Handling Best Practices
- Use descriptive error messages for config/threshold validation.
- Always throw `Error` instances, not plain objects.
- Catch and log errors in async code, especially for backend service calls.

### Where to Get Help
- Review this guide and the [Developer Setup Guide](./bias-detection-engine-setup.md).
- Check the [API Documentation](./bias-detection-api.md) for request/response errors.
- Create an issue in the repository or contact the development team for persistent problems.

---

## Application Issues

### Service Won't Start
**Symptoms:** Application fails to start, exits immediately
**Diagnosis:**
```bash
# Check application logs
kubectl logs deployment/pixelated-empathy -n default

# Check system resources
kubectl top nodes
kubectl top pods -n default

# Check configuration
kubectl get configmap pixelated-config -o yaml
kubectl get secret pixelated-secrets -o yaml
```

**Solutions:**
1. **Resource Issues:** Scale up nodes or reduce resource requests
2. **Configuration Issues:** Verify environment variables and secrets
3. **Image Issues:** Check image availability and pull policies
4. **Database Connection:** Verify database connectivity and credentials

### High Response Times
**Symptoms:** API responses > 2 seconds, user complaints
**Diagnosis:**
```bash
# Check application performance
curl -w "@curl-format.txt" -o /dev/null -s "https://pixelated-empathy.com/api/health"

# Check database performance
psql -h $DB_HOST -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check system resources
kubectl top pods -n default
```

**Solutions:**
1. **Database Optimization:** Add indexes, optimize queries
2. **Caching:** Implement Redis caching for frequent queries
3. **Scaling:** Increase pod replicas or upgrade instance types
4. **Code Optimization:** Profile application code for bottlenecks

### Memory Leaks
**Symptoms:** Increasing memory usage, OOMKilled pods
**Diagnosis:**
```bash
# Monitor memory usage over time
kubectl top pods -n default --containers

# Check for memory leaks in Node.js
node --inspect app.js
# Use Chrome DevTools to analyze heap snapshots

# Check garbage collection
node --trace-gc app.js
```

**Solutions:**
1. **Code Review:** Check for event listener leaks, unclosed connections
2. **Memory Limits:** Adjust Kubernetes memory limits
3. **Garbage Collection:** Tune Node.js GC settings
4. **Monitoring:** Implement memory monitoring and alerts

## Database Issues

### Connection Pool Exhaustion
**Symptoms:** "Too many connections" errors
**Diagnosis:**
```bash
# Check active connections
psql -h $DB_HOST -c "SELECT count(*) FROM pg_stat_activity;"

# Check connection pool settings
psql -h $DB_HOST -c "SHOW max_connections;"
```

**Solutions:**
1. **Pool Configuration:** Adjust connection pool size
2. **Connection Cleanup:** Ensure connections are properly closed
3. **Database Scaling:** Increase max_connections or use read replicas
4. **Connection Monitoring:** Implement connection pool monitoring

### Slow Queries
**Symptoms:** Database timeouts, slow application responses
**Diagnosis:**
```bash
# Enable slow query logging
psql -h $DB_HOST -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"

# Check slow queries
psql -h $DB_HOST -c "SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Analyze query plans
psql -h $DB_HOST -c "EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';"
```

**Solutions:**
1. **Indexing:** Add appropriate indexes for slow queries
2. **Query Optimization:** Rewrite inefficient queries
3. **Database Tuning:** Adjust PostgreSQL configuration
4. **Caching:** Implement query result caching

## Infrastructure Issues

### Pod Crashes
**Symptoms:** Pods restarting frequently, CrashLoopBackOff
**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n default

# Check pod logs
kubectl logs <pod-name> -n default --previous

# Check pod events
kubectl describe pod <pod-name> -n default

# Check resource limits
kubectl describe pod <pod-name> -n default | grep -A 5 "Limits"
```

**Solutions:**
1. **Resource Limits:** Adjust CPU/memory limits
2. **Health Checks:** Fix liveness/readiness probe configurations
3. **Dependencies:** Ensure all dependencies are available
4. **Image Issues:** Verify image compatibility and availability

### Load Balancer Issues
**Symptoms:** 502/503 errors, uneven traffic distribution
**Diagnosis:**
```bash
# Check nginx status
kubectl exec -it <nginx-pod> -- nginx -t

# Check upstream health
kubectl exec -it <nginx-pod> -- curl http://app1:3000/health

# Check load balancer logs
kubectl logs deployment/nginx-ingress-controller -n ingress-nginx
```

**Solutions:**
1. **Health Checks:** Fix upstream health check endpoints
2. **Configuration:** Verify nginx upstream configuration
3. **Scaling:** Ensure sufficient backend capacity
4. **DNS:** Verify service discovery and DNS resolution

## Security Issues

### Authentication Failures
**Symptoms:** Users cannot log in, JWT token errors
**Diagnosis:**
```bash
# Check authentication service logs
kubectl logs deployment/pixelated-empathy -n default | grep "auth"

# Verify JWT configuration
kubectl get secret pixelated-secrets -o yaml | grep jwt

# Test authentication endpoint
curl -X POST https://pixelated-empathy.com/api/auth/login   -H "Content-Type: application/json"   -d '{"email":"test@example.com","password":"testpass"}'
```

**Solutions:**
1. **JWT Configuration:** Verify JWT secret and expiration settings
2. **Database Issues:** Check user authentication data
3. **Rate Limiting:** Verify rate limiting isn't blocking legitimate requests
4. **SSL/TLS:** Ensure proper certificate configuration

### SSL Certificate Issues
**Symptoms:** SSL warnings, certificate expired errors
**Diagnosis:**
```bash
# Check certificate expiration
openssl s_client -connect pixelated-empathy.com:443 -servername pixelated-empathy.com | openssl x509 -noout -dates

# Check certificate chain
curl -vI https://pixelated-empathy.com

# Check cert-manager status
kubectl get certificates -n default
kubectl describe certificate pixelated-empathy-tls -n default
```

**Solutions:**
1. **Certificate Renewal:** Renew expired certificates
2. **Cert-manager:** Fix cert-manager configuration
3. **DNS Validation:** Ensure DNS records are correct
4. **Certificate Chain:** Verify complete certificate chain

## Monitoring and Alerting

### Missing Metrics
**Symptoms:** Gaps in monitoring data, missing alerts
**Diagnosis:**
```bash
# Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# Check metric endpoints
curl http://pixelated-empathy:3000/metrics

# Check Grafana data sources
curl -u admin:password http://grafana:3000/api/datasources
```

**Solutions:**
1. **Service Discovery:** Fix Prometheus service discovery
2. **Metrics Endpoints:** Ensure application exposes metrics
3. **Network Policies:** Verify monitoring traffic is allowed
4. **Configuration:** Check Prometheus and Grafana configurations

## Emergency Procedures

### Complete Service Outage
1. **Immediate Response (0-15 minutes)**
   - Acknowledge incident in monitoring system
   - Assemble incident response team
   - Check overall system status
   - Implement emergency communication plan

2. **Assessment (15-30 minutes)**
   - Identify root cause
   - Assess impact scope
   - Determine recovery strategy
   - Update stakeholders

3. **Recovery (30+ minutes)**
   - Execute recovery plan
   - Monitor recovery progress
   - Validate service restoration
   - Document incident details

### Data Breach Response
1. **Immediate Containment (0-1 hour)**
   - Isolate affected systems
   - Preserve evidence
   - Assess breach scope
   - Notify security team

2. **Investigation (1-24 hours)**
   - Conduct forensic analysis
   - Identify compromised data
   - Determine attack vector
   - Implement additional security measures

3. **Recovery and Notification (24-72 hours)**
   - Restore secure operations
   - Notify affected users
   - Submit regulatory notifications
   - Conduct post-incident review

## Contact Information

### Emergency Contacts
- **On-call Engineer:** +1-XXX-XXX-XXXX
- **Security Team:** security@pixelated-empathy.com
- **DevOps Lead:** devops@pixelated-empathy.com
- **Product Manager:** product@pixelated-empathy.com

### External Vendors
- **Cloud Provider Support:** AWS Support
- **Security Incident Response:** [External IR Firm]
- **Legal Counsel:** [Law Firm Contact]

## Escalation Matrix

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| P0 (Critical) | 15 minutes | On-call → DevOps Lead → CTO |
| P1 (High) | 1 hour | On-call → DevOps Lead |
| P2 (Medium) | 4 hours | On-call → Team Lead |
| P3 (Low) | 24 hours | Team Member |
