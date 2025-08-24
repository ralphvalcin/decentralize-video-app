# Variables for Redis Cluster Module

variable "cluster_name" {
  description = "Name of the Redis cluster"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC where Redis will be deployed"
  type        = string
}

variable "subnet_ids" {
  description = "List of subnet IDs for Redis deployment"
  type        = list(string)
}

variable "security_groups" {
  description = "List of security group IDs for Redis"
  type        = list(string)
}

variable "node_type" {
  description = "Instance type for Redis nodes"
  type        = string
  default     = "cache.r6g.medium"
}

variable "num_cache_clusters" {
  description = "Number of cache clusters in the replication group"
  type        = number
  default     = 2
  
  validation {
    condition     = var.num_cache_clusters >= 2 && var.num_cache_clusters <= 6
    error_message = "Number of cache clusters must be between 2 and 6."
  }
}

variable "parameter_group_name" {
  description = "Name of the parameter group for Redis"
  type        = string
  default     = "default.redis7.cluster.on"
}

variable "port" {
  description = "Port number for Redis"
  type        = number
  default     = 6379
}

variable "is_primary_region" {
  description = "Whether this is the primary region for Redis"
  type        = bool
  default     = false
}

variable "cross_region_replication" {
  description = "Enable cross-region replication"
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags to apply to Redis resources"
  type        = map(string)
  default     = {}
}