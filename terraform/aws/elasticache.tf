# --- ElastiCache Subnet Group ---
resource "aws_elasticache_subnet_group" "redis" {
  name       = local.redis_subnet_group_name
  subnet_ids = aws_subnet.public[*].id

  tags = local.common_tags
}

# --- ElastiCache Redis Cluster ---
resource "aws_elasticache_cluster" "redis" {
  cluster_id           = local.redis_cluster_id
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  parameter_group_name = "default.redis7"
  port                 = 6379
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]

  tags = local.common_tags
}
