# Redis Cluster Module for Cross-Region Session Management

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Redis subnet group
resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.cluster_name}-subnet-group"
  subnet_ids = var.subnet_ids

  tags = var.tags
}

# Redis parameter group
resource "aws_elasticache_parameter_group" "redis" {
  family = "redis7"
  name   = "${var.cluster_name}-params"

  # Optimized parameters for WebRTC session management
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  parameter {
    name  = "timeout"
    value = "300"
  }

  parameter {
    name  = "tcp-keepalive"
    value = "60"
  }

  # Enable keyspace notifications for cross-region sync
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"  # Expired events
  }

  tags = var.tags
}

# Redis replication group (cluster mode enabled)
resource "aws_elasticache_replication_group" "redis" {
  replication_group_id         = var.cluster_name
  description                  = "Redis cluster for ${var.cluster_name}"
  
  node_type                   = var.node_type
  port                        = var.port
  parameter_group_name        = aws_elasticache_parameter_group.redis.name
  subnet_group_name           = aws_elasticache_subnet_group.redis.name
  security_group_ids          = var.security_groups

  # Cluster configuration
  num_cache_clusters          = var.num_cache_clusters
  
  # Engine configuration
  engine_version              = "7.0"
  
  # Backup and maintenance
  maintenance_window          = var.is_primary_region ? "sun:05:00-sun:06:00" : "sun:04:00-sun:05:00"
  snapshot_retention_limit    = var.is_primary_region ? 7 : 3
  snapshot_window            = var.is_primary_region ? "03:00-05:00" : "02:00-04:00"
  
  # Security
  at_rest_encryption_enabled  = true
  transit_encryption_enabled  = true
  auth_token                 = random_password.redis_auth.result
  
  # Logging
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis.name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  # Multi-AZ for primary regions
  multi_az_enabled           = var.is_primary_region
  automatic_failover_enabled = var.is_primary_region

  tags = var.tags

  depends_on = [aws_cloudwatch_log_group.redis]
}

# Global replication group for cross-region sync
resource "aws_elasticache_global_replication_group" "redis" {
  count = var.is_primary_region && var.cross_region_replication ? 1 : 0

  global_replication_group_id_suffix = "global"
  primary_replication_group_id       = aws_elasticache_replication_group.redis.id

  description = "Global Redis replication for video chat sessions"

  tags = var.tags
}

# CloudWatch log group for Redis
resource "aws_cloudwatch_log_group" "redis" {
  name              = "/aws/elasticache/${var.cluster_name}"
  retention_in_days = var.is_primary_region ? 30 : 14

  tags = var.tags
}

# Random password for Redis auth
resource "random_password" "redis_auth" {
  length  = 32
  special = true
}

# Store Redis auth token in AWS Secrets Manager
resource "aws_secretsmanager_secret" "redis_auth" {
  name        = "${var.cluster_name}-redis-auth"
  description = "Redis authentication token for ${var.cluster_name}"

  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "redis_auth" {
  secret_id     = aws_secretsmanager_secret.redis_auth.id
  secret_string = jsonencode({
    auth_token = random_password.redis_auth.result
    endpoint   = aws_elasticache_replication_group.redis.configuration_endpoint_address
    port       = aws_elasticache_replication_group.redis.port
  })
}

# CloudWatch alarms for Redis monitoring
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  alarm_name          = "${var.cluster_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "This metric monitors Redis CPU utilization"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.redis.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  alarm_name          = "${var.cluster_name}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "85"
  alarm_description   = "This metric monitors Redis memory utilization"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.redis.id
  }

  tags = var.tags
}

resource "aws_cloudwatch_metric_alarm" "redis_connections" {
  alarm_name          = "${var.cluster_name}-redis-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CurrConnections"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "1000"
  alarm_description   = "This metric monitors Redis connection count"
  alarm_actions       = [aws_sns_topic.redis_alerts.arn]

  dimensions = {
    CacheClusterId = aws_elasticache_replication_group.redis.id
  }

  tags = var.tags
}

# SNS topic for Redis alerts
resource "aws_sns_topic" "redis_alerts" {
  name = "${var.cluster_name}-redis-alerts"

  tags = var.tags
}

# Custom metric for WebRTC session tracking
resource "aws_cloudwatch_log_metric_filter" "webrtc_sessions" {
  name           = "${var.cluster_name}-webrtc-sessions"
  log_group_name = aws_cloudwatch_log_group.redis.name
  pattern        = "[timestamp, request_id=\"session:*\", ...]"

  metric_transformation {
    name      = "WebRTCActiveSessions"
    namespace = "VideoChat/Redis"
    value     = "1"
    
    default_value = 0
  }
}

# Custom metric for room occupancy
resource "aws_cloudwatch_log_metric_filter" "room_occupancy" {
  name           = "${var.cluster_name}-room-occupancy"
  log_group_name = aws_cloudwatch_log_group.redis.name
  pattern        = "[timestamp, request_id=\"room:*:users\", ...]"

  metric_transformation {
    name      = "RoomOccupancy"
    namespace = "VideoChat/Redis"
    value     = "1"
    
    default_value = 0
  }
}