// SSRF protection: Centralized URL validation utility
// Removed localhost and 127.0.0.1 to prevent local service attacks
export const ALLOWED_DOMAINS = [
  'huggingface.co',
  'mlflow.company.com',
  'api.wandb.ai',
  'ml.azure.com',
  'wandb.ai',
  'pixelatedempathy.com',
  'pixelatedempathy.tech',
  'goat.pixelatedempathy.tech',
  'git.pixelatedempathy.tech',
  // Add any additional domains your application needs here
  // 'your-domain.com',
  // 'api.your-service.com',
]

// IP-based whitelist (resolve these domains to prevent DNS rebinding)
export const ALLOWED_IPS = [
  // Hugging Face IPs (resolve from huggingface.co)
  '185.92.25.0/24', // Example CIDR - in real implementation, use actual resolved IPs
  // Add actual resolved IPs for each service
]
