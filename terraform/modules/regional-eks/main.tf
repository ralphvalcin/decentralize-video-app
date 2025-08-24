# Regional EKS Module for Multi-Region Deployment
# This module creates a complete EKS cluster in a specific region

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.20"
    }
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local values for this region
locals {
  cluster_name = var.cluster_name
  vpc_cidr     = "10.${var.region == "us-west-2" ? 0 : var.region == "eu-west-1" ? 1 : 2}.0.0/16"
  azs          = slice(data.aws_availability_zones.available.names, 0, 3)
}

# VPC for this region
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.cluster_name}-vpc"
  cidr = local.vpc_cidr

  azs             = local.azs
  private_subnets = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 4, k)]
  public_subnets  = [for k, v in local.azs : cidrsubnet(local.vpc_cidr, 8, k + 48)]

  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  single_nat_gateway   = !var.is_primary_region  # Cost optimization for secondary regions

  # Kubernetes-specific tags
  public_subnet_tags = {
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "owned"
  }

  private_subnet_tags = {
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/${local.cluster_name}" = "owned"
  }

  tags = var.tags
}

# EKS Cluster
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = local.cluster_name
  cluster_version = var.kubernetes_version

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  # Enable cluster creator admin permissions
  enable_cluster_creator_admin_permissions = true

  # Cluster addons
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
      configuration_values = jsonencode({
        env = {
          ENABLE_POD_ENI                    = "true"
          ENABLE_PREFIX_DELEGATION          = "true"
          POD_SECURITY_GROUP_ENFORCING_MODE = "standard"
        }
      })
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.irsa_ebs_csi.iam_role_arn
    }
  }

  # EKS Managed Node Groups
  eks_managed_node_groups = {
    # General purpose nodes
    general = {
      name = "general-${var.region}"

      instance_types = var.is_primary_region ? ["m5.large", "m5a.large"] : ["m5.medium", "m5a.medium"]
      capacity_type  = "ON_DEMAND"
      
      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      disk_size = var.is_primary_region ? 50 : 30
      disk_type = "gp3"

      labels = {
        Environment  = var.environment
        NodeGroup    = "general"
        Region       = var.region
        InstanceType = "on-demand"
      }

      taints = []

      update_config = {
        max_unavailable_percentage = 25
      }
    }

    # Spot instances for cost optimization
    spot = {
      name = "spot-${var.region}"

      instance_types = var.is_primary_region ? 
        ["m5.large", "m5a.large", "m5d.large", "c5.large", "c5a.large"] :
        ["m5.medium", "m5a.medium", "c5.medium", "c5a.medium"]
      capacity_type  = "SPOT"
      
      min_size     = 1
      max_size     = var.is_primary_region ? 15 : 10
      desired_size = var.is_primary_region ? 3 : 2

      disk_size = 30
      disk_type = "gp3"

      labels = {
        Environment  = var.environment
        NodeGroup    = "spot"
        Region       = var.region
        InstanceType = "spot"
      }

      taints = [
        {
          key    = "spot-instance"
          value  = "true"
          effect = "NO_SCHEDULE"
        }
      ]

      # Spot instance configuration
      block_device_mappings = {
        xvda = {
          device_name = "/dev/xvda"
          ebs = {
            volume_size = 30
            volume_type = "gp3"
            throughput  = 150
            encrypted   = true
          }
        }
      }
    }
  }

  # Node security group additional rules
  node_security_group_additional_rules = {
    # Allow nodes to communicate with each other
    ingress_self_all = {
      description = "Node to node all ports/protocols"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "ingress"
      self        = true
    }

    # Allow nodes to receive traffic from ALB
    ingress_alb_all = {
      description                = "ALB to node all ports"
      protocol                   = "-1"
      from_port                  = 0
      to_port                    = 0
      type                       = "ingress"
      source_security_group_id   = aws_security_group.alb.id
    }

    # Egress all
    egress_all = {
      description = "Node all egress"
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      type        = "egress"
      cidr_blocks = ["0.0.0.0/0"]
    }
  }

  tags = var.tags
}

# IRSA for EBS CSI driver
module "irsa_ebs_csi" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-assumable-role-with-oidc"
  version = "~> 5.0"

  create_role                   = true
  role_name                     = "${local.cluster_name}-ebs-csi"
  provider_url                  = module.eks.cluster_oidc_issuer_url
  role_policy_arns              = [data.aws_iam_policy.ebs_csi_policy.arn]
  oidc_fully_qualified_subjects = ["system:serviceaccount:kube-system:ebs-csi-controller-sa"]

  tags = var.tags
}

data "aws_iam_policy" "ebs_csi_policy" {
  arn = "arn:aws:iam::aws:policy/service-role/Amazon_EBS_CSI_DriverPolicy"
}

# Application Load Balancer
resource "aws_lb" "main" {
  name               = "${local.cluster_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets           = module.vpc.public_subnets

  enable_deletion_protection = var.is_primary_region

  # Access logs
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    prefix  = "alb-logs"
    enabled = true
  }

  tags = var.tags
}

# ALB Security Group
resource "aws_security_group" "alb" {
  name_prefix = "${local.cluster_name}-alb"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${local.cluster_name}-alb-sg"
  })
}

# S3 bucket for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${local.cluster_name}-alb-logs-${random_string.suffix.result}"

  tags = var.tags
}

resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ALB bucket policy for access logs
data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = data.aws_elb_service_account.main.arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-logs/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/alb-logs/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

# Redis cluster for session management
module "redis" {
  source = "./redis-cluster"

  cluster_name     = "${local.cluster_name}-redis"
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnets
  security_groups = [aws_security_group.redis.id]
  
  node_type                = var.is_primary_region ? "cache.r6g.large" : "cache.r6g.medium"
  num_cache_clusters       = var.is_primary_region ? 3 : 2
  parameter_group_name     = "default.redis7.cluster.on"
  port                     = 6379
  
  # Cross-region replication settings
  is_primary_region        = var.is_primary_region
  cross_region_replication = var.enable_cross_region_peering
  
  tags = var.tags
}

# Redis security group
resource "aws_security_group" "redis" {
  name_prefix = "${local.cluster_name}-redis"
  vpc_id      = module.vpc.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [module.eks.node_security_group_id]
  }

  # Allow cross-region Redis communication
  dynamic "ingress" {
    for_each = var.enable_cross_region_peering ? var.peer_region_cidrs : []
    content {
      description = "Redis from peer region"
      from_port   = 6379
      to_port     = 6379
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name = "${local.cluster_name}-redis-sg"
  })
}

# Cross-region VPC peering connections
resource "aws_vpc_peering_connection" "cross_region" {
  count = var.enable_cross_region_peering && var.is_primary_region ? length(var.peer_region_cidrs) : 0

  vpc_id        = module.vpc.vpc_id
  peer_vpc_id   = var.peer_vpc_ids[count.index]
  peer_region   = var.peer_regions[count.index]
  auto_accept   = false

  tags = merge(var.tags, {
    Name = "${local.cluster_name}-peering-${count.index}"
  })
}

# CloudWatch Log Group for EKS cluster
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/${local.cluster_name}/cluster"
  retention_in_days = var.is_primary_region ? 30 : 14

  tags = var.tags
}

# Random string for unique resource naming
resource "random_string" "suffix" {
  length  = 8
  special = false
  upper   = false
}