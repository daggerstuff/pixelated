terraform {
  backend "gcs" {
    bucket = "pixelated-empathy-terraform-state"
    prefix = "terraform/state/gcp"
    # Workspaces can be split by environment using terraform workspaces.
  }
}