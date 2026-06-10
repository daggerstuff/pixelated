# Terraform configuration to create the service-linked role for AWS License Manager
# Reference: https://docs.aws.amazon.com/license-manager/latest/userguide/license-manager-role-core.html

resource "aws_iam_service_linked_role" "license_manager" {
  aws_service_name = "license-manager.amazonaws.com"
  description      = "Service-linked role for AWS License Manager to manage licenses on your behalf"
}
