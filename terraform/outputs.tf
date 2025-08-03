# Output values for Terraform configuration

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "VPC CIDR block"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.vpc.private_subnets
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.vpc.public_subnets
}

output "eks_cluster_id" {
  description = "EKS cluster ID"
  value       = module.eks.cluster_id
}

output "eks_cluster_arn" {
  description = "EKS cluster ARN"
  value       = module.eks.cluster_arn
}

output "eks_cluster_endpoint" {
  description = "EKS cluster endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_cluster_security_group_id" {
  description = "EKS cluster security group ID"
  value       = module.eks.cluster_security_group_id
}

output "eks_cluster_oidc_issuer_url" {
  description = "EKS cluster OIDC issuer URL"
  value       = module.eks.cluster_oidc_issuer_url
}

output "eks_node_groups" {
  description = "EKS node groups"
  value       = module.eks.eks_managed_node_groups
  sensitive   = true
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "s3_bucket_id" {
  description = "S3 bucket ID for frontend assets"
  value       = aws_s3_bucket.frontend.id
}

output "s3_bucket_arn" {
  description = "S3 bucket ARN for frontend assets"
  value       = aws_s3_bucket.frontend.arn
}

output "s3_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.frontend.bucket_domain_name
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN"
  value       = aws_acm_certificate.frontend.arn
}

output "waf_web_acl_id" {
  description = "WAF Web ACL ID"
  value       = aws_wafv2_web_acl.frontend.id
}

output "waf_web_acl_arn" {
  description = "WAF Web ACL ARN"
  value       = aws_wafv2_web_acl.frontend.arn
}

# RDS outputs (conditional)
output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = var.enable_rds ? module.rds[0].db_instance_endpoint : null
}

output "rds_port" {
  description = "RDS instance port"
  value       = var.enable_rds ? module.rds[0].db_instance_port : null
}

output "rds_database_name" {
  description = "RDS database name"
  value       = var.enable_rds ? module.rds[0].db_instance_name : null
}

output "rds_username" {
  description = "RDS master username"
  value       = var.enable_rds ? module.rds[0].db_instance_username : null
  sensitive   = true
}

# Kubeconfig command
output "kubeconfig_command" {
  description = "Command to update kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_id}"
}

# Application URLs
output "application_urls" {
  description = "Application URLs"
  value = {
    frontend_cloudfront = "https://${aws_cloudfront_distribution.frontend.domain_name}"
    frontend_custom     = var.environment == "production" ? "https://video-chat.example.com" : "https://${var.environment}.video-chat.example.com"
  }
}

# Monitoring endpoints
output "monitoring_endpoints" {
  description = "Monitoring and observability endpoints"
  value = {
    prometheus_url = "http://prometheus.${var.environment}.video-chat.local:9090"
    grafana_url    = "http://grafana.${var.environment}.video-chat.local:3000"
  }
}

# Security information
output "security_information" {
  description = "Security-related information"
  value = {
    vpc_security_group_id     = module.eks.cluster_security_group_id
    additional_security_group = aws_security_group.additional.id
    waf_enabled              = var.enable_waf
    cloudfront_oai           = aws_cloudfront_origin_access_identity.frontend.id
  }
}

# Cost optimization information
output "cost_optimization" {
  description = "Cost optimization information"
  value = {
    spot_instances_enabled = var.enable_spot_instances
    cloudfront_price_class = var.cloudfront_price_class
    environment           = var.environment
  }
}