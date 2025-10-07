#!/bin/bash
set -e

# Infrastructure Testing Script
echo "🧪 Testing Infrastructure Configuration..."

# Validate Terraform configuration
echo "Validating Terraform configuration..."
terraform init -backend=false
terraform validate
terraform fmt -check=true

# Plan infrastructure changes
echo "Planning infrastructure changes..."
terraform plan -var-file="environments/$ENVIRONMENT/terraform.tfvars" -out=tfplan

# Validate plan
echo "Validating infrastructure plan..."
terraform show -json tfplan | jq '.planned_values.root_module.resources[] | select(.type == "aws_instance") | .values.instance_type'

# Security scan
echo "Running security scan..."
checkov -f main.tf --framework terraform

# Cost estimation
echo "Estimating costs..."
infracost breakdown --path . --terraform-var-file="environments/$ENVIRONMENT/terraform.tfvars"

echo "✅ Infrastructure testing completed successfully"
