# Outputs for Regional EKS Module

output "cluster_id" {
  description = "ID of the EKS cluster"
  value       = module.eks.cluster_id
}

output "cluster_arn" {
  description = "ARN of the EKS cluster"
  value       = module.eks.cluster_arn
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane"
  value       = module.eks.cluster_endpoint
}

output "cluster_security_group_id" {
  description = "Security group ID attached to the EKS cluster"
  value       = module.eks.cluster_security_group_id
}

output "cluster_iam_role_name" {
  description = "IAM role name associated with EKS cluster"
  value       = module.eks.cluster_iam_role_name
}

output "cluster_oidc_issuer_url" {
  description = "The URL on the EKS cluster OIDC Issuer"
  value       = module.eks.cluster_oidc_issuer_url
}

output "vpc_id" {
  description = "ID of the VPC where the cluster is deployed"
  value       = module.vpc.vpc_id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = module.vpc.vpc_cidr_block
}

output "private_subnets" {
  description = "List of IDs of private subnets"
  value       = module.vpc.private_subnets
}

output "public_subnets" {
  description = "List of IDs of public subnets"
  value       = module.vpc.public_subnets
}

output "alb_arn" {
  description = "ARN of the Application Load Balancer"
  value       = aws_lb.main.arn
}

output "alb_dns_name" {
  description = "DNS name of the Application Load Balancer"
  value       = aws_lb.main.dns_name
}

output "alb_zone_id" {
  description = "Zone ID of the Application Load Balancer"
  value       = aws_lb.main.zone_id
}

output "alb_security_group_id" {
  description = "Security group ID of the Application Load Balancer"
  value       = aws_security_group.alb.id
}

output "redis_endpoint" {
  description = "Redis cluster endpoint"
  value       = module.redis.endpoint
}

output "redis_port" {
  description = "Redis cluster port"
  value       = module.redis.port
}

output "node_groups" {
  description = "Map of node group configurations"
  value = {
    general = {
      node_group_name = module.eks.eks_managed_node_groups.general.node_group_id
      capacity_type   = "ON_DEMAND"
      instance_types  = var.is_primary_region ? ["m5.large", "m5a.large"] : ["m5.medium", "m5a.medium"]
    }
    spot = {
      node_group_name = module.eks.eks_managed_node_groups.spot.node_group_id
      capacity_type   = "SPOT"
      instance_types  = var.is_primary_region ? 
        ["m5.large", "m5a.large", "m5d.large", "c5.large", "c5a.large"] :
        ["m5.medium", "m5a.medium", "c5.medium", "c5a.medium"]
    }
  }
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch log group name for the EKS cluster"
  value       = aws_cloudwatch_log_group.eks_cluster.name
}

output "region" {
  description = "AWS region where the cluster is deployed"
  value       = var.region
}

output "is_primary_region" {
  description = "Whether this is the primary region"
  value       = var.is_primary_region
}