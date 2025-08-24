# Variables for Regional EKS Module

variable "region" {
  description = "AWS region for this EKS cluster"
  type        = string
}

variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "is_primary_region" {
  description = "Whether this is the primary region"
  type        = bool
  default     = false
}

variable "node_min_size" {
  description = "Minimum number of nodes in the node group"
  type        = number
  default     = 2
}

variable "node_max_size" {
  description = "Maximum number of nodes in the node group"
  type        = number
  default     = 20
}

variable "node_desired_size" {
  description = "Desired number of nodes in the node group"
  type        = number
  default     = 3
}

variable "backend_min_replicas" {
  description = "Minimum number of backend replicas"
  type        = number
  default     = 2
}

variable "backend_max_replicas" {
  description = "Maximum number of backend replicas"
  type        = number
  default     = 20
}

variable "spot_instance_percentage" {
  description = "Percentage of spot instances to use"
  type        = number
  default     = 50
  
  validation {
    condition     = var.spot_instance_percentage >= 0 && var.spot_instance_percentage <= 100
    error_message = "Spot instance percentage must be between 0 and 100."
  }
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  default     = "production"
}

variable "enable_cross_region_peering" {
  description = "Enable cross-region VPC peering"
  type        = bool
  default     = false
}

variable "peer_region_cidrs" {
  description = "CIDR blocks of peer regions for VPC peering"
  type        = list(string)
  default     = []
}

variable "peer_vpc_ids" {
  description = "VPC IDs of peer regions"
  type        = list(string)
  default     = []
}

variable "peer_regions" {
  description = "Names of peer regions"
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default     = {}
}