# Outputs for Redis Cluster Module

output "replication_group_id" {
  description = "ID of the Redis replication group"
  value       = aws_elasticache_replication_group.redis.id
}

output "endpoint" {
  description = "Redis cluster endpoint"
  value       = aws_elasticache_replication_group.redis.configuration_endpoint_address
}

output "port" {
  description = "Redis cluster port"
  value       = aws_elasticache_replication_group.redis.port
}

output "auth_token_secret_arn" {
  description = "ARN of the AWS Secrets Manager secret containing Redis auth token"
  value       = aws_secretsmanager_secret.redis_auth.arn
}

output "auth_token_secret_name" {
  description = "Name of the AWS Secrets Manager secret containing Redis auth token"
  value       = aws_secretsmanager_secret.redis_auth.name
}

output "global_replication_group_id" {
  description = "ID of the global replication group (if enabled)"
  value       = var.is_primary_region && var.cross_region_replication ? aws_elasticache_global_replication_group.redis[0].global_replication_group_id : null
}

output "parameter_group_name" {
  description = "Name of the Redis parameter group"
  value       = aws_elasticache_parameter_group.redis.name
}

output "subnet_group_name" {
  description = "Name of the Redis subnet group"
  value       = aws_elasticache_subnet_group.redis.name
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for Redis"
  value       = aws_cloudwatch_log_group.redis.name
}

output "sns_topic_arn" {
  description = "ARN of the SNS topic for Redis alerts"
  value       = aws_sns_topic.redis_alerts.arn
}

output "cluster_nodes" {
  description = "List of cluster nodes"
  value       = aws_elasticache_replication_group.redis.cache_nodes
}

output "engine_version" {
  description = "Redis engine version"
  value       = aws_elasticache_replication_group.redis.engine_version
}