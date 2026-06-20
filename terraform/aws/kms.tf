resource "aws_kms_key" "cloudwatch" {
  description             = "KMS key for CloudWatch log encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_key" "ecr" {
  description             = "KMS key for ECR repository encryption"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = local.common_tags
}

resource "aws_kms_alias" "cloudwatch" {
  name          = "alias/${local.label}-cloudwatch-logs"
  target_key_id = aws_kms_key.cloudwatch.key_id
}

resource "aws_kms_alias" "ecr" {
  name          = "alias/${local.label}-ecr"
  target_key_id = aws_kms_key.ecr.key_id
}