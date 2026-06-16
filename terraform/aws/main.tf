provider "aws" {
  region = var.aws_region
}

data "aws_caller_identity" "current" {}

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.90"
    }
  }

  backend "s3" {
    bucket       = "pixelated-empathy-terraform-state-638175140335"
    key          = "terraform/state/aws"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}
