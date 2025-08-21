# GitLab Pipeline Variables & Troubleshooting

## Required Variables

- `VPS_SSH_PRIVATE_KEY_B64`: Base64-encoded SSH private key for VPS access
- `VPS_USER`: SSH username for VPS
- `VPS_HOST`: Hostname or IP address of VPS
- `VPS_DOMAIN`: (Optional) Custom domain for HTTPS guest access
- `qodana_token`: (If using Qodana job) JetBrains Qodana token

## Registry Variables (usually set automatically)

- `CI_REGISTRY`
- `CI_REGISTRY_USER`
- `CI_REGISTRY_PASSWORD`
- `CI_REGISTRY_IMAGE`

## Best Practices

- Use GitLab protected variables for all secrets and tokens.
- Set up staging and production environments for safe deployments.
- Monitor health checks and configure notifications for failures.
- Tag images with branch/build for traceability.
- Retain logs/artifacts for debugging.
- Regularly clean up old images to save space.

## Troubleshooting

- **Deployment fails:** Check SSH key, VPS_HOST, and registry credentials.
- **Health check fails:** Ensure app is running and accessible at the configured domain/IP.
- **Caddy setup issues:** Confirm VPS_DOMAIN is set and DNS points to VPS IP.
- **Rollback needed:** Use the rollback job to restore previous container version.

For further help, see `.gitlab-ci.yml` comments and job definitions.