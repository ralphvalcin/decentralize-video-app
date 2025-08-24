# Multi-Region Infrastructure Configuration for Video Chat Application
# Extends existing main.tf to support multi-region deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
      configuration_aliases = [aws.us_west_2, aws.eu_west_1, aws.ap_southeast_1]
    }
  }
}

# Regional provider configurations
provider "aws" {
  alias  = "us_west_2"
  region = "us-west-2"
  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
  default_tags {
    tags = local.common_tags
  }
}

provider "aws" {
  alias  = "ap_southeast_1" 
  region = "ap-southeast-1"
  default_tags {
    tags = local.common_tags
  }
}

# Multi-region local variables
locals {
  regions = {
    primary = {
      name              = "us-west-2"
      provider         = aws.us_west_2
      is_primary       = true
      node_min_size    = 3
      node_max_size    = 20
      node_desired     = 5
      backend_min      = 3
      backend_max      = 50
    }
    secondary = {
      name              = "eu-west-1" 
      provider         = aws.eu_west_1
      is_primary       = false
      node_min_size    = 2
      node_max_size    = 15
      node_desired     = 3
      backend_min      = 2
      backend_max      = 30
    }
    tertiary = {
      name              = "ap-southeast-1"
      provider         = aws.ap_southeast_1
      is_primary       = false
      node_min_size    = 2
      node_max_size    = 15
      node_desired     = 3
      backend_min      = 2
      backend_max      = 30
    }
  }
}

# Multi-region EKS deployment
module "multi_region_eks" {
  for_each = local.regions
  source   = "./modules/regional-eks"
  
  providers = {
    aws = each.value.provider
  }

  region                  = each.value.name
  is_primary_region      = each.value.is_primary
  cluster_name           = "${var.project_name}-${var.environment}-${replace(each.value.name, "-", "")}"
  kubernetes_version     = var.kubernetes_version
  
  # Node group configuration
  node_min_size          = each.value.node_min_size
  node_max_size          = each.value.node_max_size  
  node_desired_size      = each.value.node_desired
  
  # Application scaling
  backend_min_replicas   = each.value.backend_min
  backend_max_replicas   = each.value.backend_max
  
  # Cost optimization - increase spot usage for secondary regions
  spot_instance_percentage = each.value.is_primary ? 50 : 70
  
  # Cross-region networking
  enable_cross_region_peering = true
  peer_region_cidrs          = [for k, v in local.regions : "10.${k == "primary" ? 0 : k == "secondary" ? 1 : 2}.0.0/16" if k != each.key]
  
  tags = merge(local.common_tags, {
    Region = each.value.name
    Tier   = each.value.is_primary ? "primary" : "secondary"
  })
}

# Global Accelerator for WebRTC signaling optimization
resource "aws_globalaccelerator_accelerator" "webrtc_signaling" {
  name              = "${var.project_name}-${var.environment}-webrtc"
  ip_address_type   = "IPV4"
  enabled           = true

  attributes {
    flow_logs_enabled   = true
    flow_logs_s3_bucket = aws_s3_bucket.flow_logs.id
    flow_logs_s3_prefix = "webrtc-signaling"
  }

  tags = local.common_tags
}

# Global Accelerator listener for WebSocket connections
resource "aws_globalaccelerator_listener" "webrtc_websocket" {
  accelerator_arn = aws_globalaccelerator_accelerator.webrtc_signaling.id
  client_affinity = "SOURCE_IP"
  protocol        = "TCP"

  port_range {
    from_port = 443
    to_port   = 443
  }
}

# Regional endpoint groups for Global Accelerator
resource "aws_globalaccelerator_endpoint_group" "regions" {
  for_each = local.regions

  listener_arn                      = aws_globalaccelerator_listener.webrtc_websocket.id
  endpoint_group_region            = each.value.name
  traffic_dial_percentage          = each.value.is_primary ? 60 : 20
  health_check_interval_seconds    = 10
  health_check_path               = "/health"
  health_check_protocol           = "HTTPS"
  health_check_port               = 443
  healthy_threshold_count         = 2
  unhealthy_threshold_count       = 3

  endpoint_configuration {
    endpoint_id                    = module.multi_region_eks[each.key].alb_arn
    weight                        = each.value.is_primary ? 100 : 50
    client_ip_preservation_enabled = true
  }

  port_override {
    listener_port = 443
    endpoint_port = 80
  }
}

# Route 53 Health Checks for each region
resource "aws_route53_health_check" "regional" {
  for_each = local.regions

  fqdn                            = module.multi_region_eks[each.key].alb_dns_name
  port                           = 80
  type                           = "HTTP"
  resource_path                  = "/health"
  failure_threshold             = 3
  request_interval              = 10
  cloudwatch_logs_region        = each.value.name
  cloudwatch_logs_group         = "/aws/route53/healthcheck"
  insufficient_data_health_status = "Failure"

  tags = merge(local.common_tags, {
    Name   = "${var.project_name}-${var.environment}-${each.key}-healthcheck"
    Region = each.value.name
  })
}

# Route 53 DNS records with latency-based routing
resource "aws_route53_record" "regional_api" {
  for_each = local.regions

  zone_id = aws_route53_zone.main.zone_id
  name    = "api"
  type    = "A"
  
  set_identifier = each.value.name
  
  latency_routing_policy {
    region = each.value.name
  }
  
  health_check_id = aws_route53_health_check.regional[each.key].id

  alias {
    name                   = module.multi_region_eks[each.key].alb_dns_name
    zone_id               = module.multi_region_eks[each.key].alb_zone_id
    evaluate_target_health = true
  }
}

# Global Route 53 hosted zone
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = local.common_tags
}

# CloudFront distribution with multi-region origins
resource "aws_cloudfront_distribution" "global_frontend" {
  comment         = "Global Video Chat Frontend Distribution"
  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_100"

  # Primary origin (us-west-2)
  origin {
    domain_name = module.multi_region_eks["primary"].alb_dns_name
    origin_id   = "primary-backend"
    
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    origin_shield {
      enabled              = true
      origin_shield_region = "us-west-2"
    }
  }

  # Secondary origins for failover
  dynamic "origin" {
    for_each = { for k, v in local.regions : k => v if !v.is_primary }
    
    content {
      domain_name = module.multi_region_eks[origin.key].alb_dns_name
      origin_id   = "${origin.key}-backend"
      
      custom_origin_config {
        http_port              = 80
        https_port             = 443
        origin_protocol_policy = "https-only"
        origin_ssl_protocols   = ["TLSv1.2"]
      }
    }
  }

  # Origin groups for automatic failover
  origin_group {
    origin_id = "backend-group"
    
    failover_criteria {
      status_codes = [403, 404, 500, 502, 503, 504]
    }
    
    member {
      origin_id = "primary-backend"
    }
    
    member {
      origin_id = "secondary-backend"
    }
  }

  # Default cache behavior
  default_cache_behavior {
    target_origin_id         = "backend-group"
    viewer_protocol_policy   = "redirect-to-https"
    compress                = true
    cached_methods          = ["GET", "HEAD"]
    allowed_methods         = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "CloudFront-Forwarded-Proto", "Host", "Origin"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 31536000
  }

  # WebSocket cache behavior
  ordered_cache_behavior {
    path_pattern           = "/socket.io/*"
    target_origin_id       = "backend-group"
    viewer_protocol_policy = "https-only"
    cached_methods         = ["GET", "HEAD"]
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    compress              = false

    forwarded_values {
      query_string = true
      headers      = ["*"]
      cookies {
        forward = "all"
      }
    }

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 0
  }

  # Geographic restrictions
  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # SSL certificate
  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.global.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  # Custom error pages for SPA
  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 0
  }

  web_acl_id = aws_wafv2_web_acl.global.arn

  tags = local.common_tags
}

# Global SSL certificate
resource "aws_acm_certificate" "global" {
  provider          = aws.us_west_2  # Must be in us-east-1 for CloudFront, but we'll use us-west-2
  domain_name       = var.domain_name
  validation_method = "DNS"

  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}"
  ]

  lifecycle {
    create_before_destroy = true
  }

  tags = local.common_tags
}

# S3 bucket for Global Accelerator flow logs
resource "aws_s3_bucket" "flow_logs" {
  provider = aws.us_west_2
  bucket   = "${var.project_name}-${var.environment}-ga-flow-logs-${random_string.bucket_suffix.result}"

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "flow_logs" {
  provider = aws.us_west_2
  bucket   = aws_s3_bucket.flow_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "flow_logs" {
  provider = aws.us_west_2
  bucket   = aws_s3_bucket.flow_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Global WAF for DDoS protection
resource "aws_wafv2_web_acl" "global" {
  provider = aws.us_west_2  # For CloudFront, must be in us-east-1, but using us-west-2
  name     = "${var.project_name}-${var.environment}-global-waf"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Rate limiting rule
  rule {
    name     = "GlobalRateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit                = 5000  # Higher limit for WebRTC signaling
        aggregate_key_type   = "IP"
        
        scope_down_statement {
          byte_match_statement {
            search_string = "socket.io"
            field_to_match {
              uri_path {}
            }
            text_transformation {
              priority = 0
              type     = "LOWERCASE"
            }
            positional_constraint = "CONTAINS"
          }
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GlobalRateLimitRule"
      sampled_requests_enabled   = true
    }
  }

  # Geographic blocking for high-risk regions (optional)
  rule {
    name     = "GeographicRule"
    priority = 2

    action {
      block {}
    }

    statement {
      geo_match_statement {
        country_codes = ["CN", "RU", "KP"]  # Example: block high-risk countries
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "GeographicRule"
      sampled_requests_enabled   = true
    }
  }

  tags = local.common_tags

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-global-waf"
    sampled_requests_enabled   = true
  }
}

# Cross-region replication setup for disaster recovery
resource "aws_s3_bucket_replication_configuration" "disaster_recovery" {
  for_each = { for k, v in local.regions : k => v if v.is_primary }
  
  provider   = aws.us_west_2
  role       = aws_iam_role.replication.arn
  bucket     = aws_s3_bucket.frontend.id
  depends_on = [aws_s3_bucket_versioning.frontend]

  rule {
    id       = "disaster-recovery-replication"
    status   = "Enabled"
    priority = 1

    destination {
      bucket        = aws_s3_bucket.disaster_recovery["secondary"].arn
      storage_class = "STANDARD_IA"
      
      replica_kms_key_id = aws_kms_key.replication["secondary"].arn
    }
  }
}

# Disaster recovery S3 buckets
resource "aws_s3_bucket" "disaster_recovery" {
  for_each = { for k, v in local.regions : k => v if !v.is_primary }
  
  provider = each.value.provider
  bucket   = "${var.project_name}-${var.environment}-dr-${each.key}-${random_string.bucket_suffix.result}"

  tags = merge(local.common_tags, {
    Purpose = "disaster-recovery"
    Region  = each.value.name
  })
}

# KMS keys for cross-region replication
resource "aws_kms_key" "replication" {
  for_each = { for k, v in local.regions : k => v if !v.is_primary }
  
  provider    = each.value.provider
  description = "KMS key for cross-region replication to ${each.value.name}"

  tags = local.common_tags
}

# IAM role for S3 replication
resource "aws_iam_role" "replication" {
  provider = aws.us_west_2
  name     = "${var.project_name}-${var.environment}-replication-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "s3.amazonaws.com"
        }
      }
    ]
  })

  tags = local.common_tags
}

# Random string for bucket naming
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}