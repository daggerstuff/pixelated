terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.115"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.32"
    }
  }
}

# Configure the Azure Provider
provider "azurerm" {
  features {
    # Use default feature settings
    # Customize as needed for specific resource behaviors
  }
}