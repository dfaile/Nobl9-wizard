# Nobl9 Wizard - Terraform Variables
# This file defines all variables used in the Terraform configuration

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "nobl9-wizard"
}

variable "environment" {
  description = "Environment name (e.g., dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "owner" {
  description = "Owner of the resources (for tagging)"
  type        = string
  default     = "nobl9-team"
}

variable "nobl9_client_id" {
  description = "Nobl9 API Client ID (will be stored in Parameter Store)"
  type        = string
  sensitive   = true
}

variable "nobl9_client_secret" {
  description = "Nobl9 API Client Secret (will be stored in Parameter Store)"
  type        = string
  sensitive   = true
}

variable "nobl9_skip_tls_verify" {
  description = "Skip TLS verification for Nobl9 API calls (set to 'true' if needed)"
  type        = string
  default     = "false"
}

variable "lambda_timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30
}

variable "alarm_actions" {
  description = "List of ARNs for CloudWatch alarm actions (e.g., SNS topics)"
  type        = list(string)
  default     = []
}

variable "enable_api_gateway_logging" {
  description = "Enable detailed logging for API Gateway"
  type        = bool
  default     = false
}

variable "api_gateway_log_level" {
  description = "Log level for API Gateway (INFO, ERROR, or OFF)"
  type        = string
  default     = "INFO"
  validation {
    condition     = contains(["INFO", "ERROR", "OFF"], var.api_gateway_log_level)
    error_message = "API Gateway log level must be one of: INFO, ERROR, OFF."
  }
}

variable "enable_xray_tracing" {
  description = "Enable X-Ray tracing for Lambda function"
  type        = bool
  default     = false
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrency for Lambda function (0 for unlimited)"
  type        = number
  default     = 0
}

variable "enable_cloudwatch_dashboard" {
  description = "Enable CloudWatch dashboard for monitoring"
  type        = bool
  default     = true
}

variable "enable_cloudwatch_alarms" {
  description = "Enable CloudWatch alarms for monitoring"
  type        = bool
  default     = true
}

variable "frontend_bucket_versioning" {
  description = "Enable versioning for frontend S3 bucket"
  type        = bool
  default     = false
}

variable "lambda_bucket_versioning" {
  description = "Enable versioning for Lambda S3 bucket"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
} 