# Terraform backend configuration for GitLab-managed state
# The actual backend configuration is provided via backend.config file
# This block defines the backend type only

terraform {
  backend "http" {
    # Values are provided via -backend-config=backend.config
    # See backend.config for actual configuration
    # Lock/unlock methods are specified in backend.config
  }
}

# To use GitLab-managed state:
# 1. Copy backend.config.example to backend.config
# 2. Update backend.config with your GitLab project ID
# 3. Set TF_HTTP_PASSWORD environment variable with your GitLab token
# 4. Run: terraform init -backend-config=backend.config
# 
# Note: If state doesn't exist yet, you may need to run the first operation
# with -lock=false to create the initial state file