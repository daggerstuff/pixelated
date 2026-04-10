terraform {
  backend "gcs" {
    bucket = "pixelated-empathy-terraform-state"
    prefix = "terraform/state/gcp"
    # Workspaces split by environment (e.g. terraform workspace select staging)
  }
}