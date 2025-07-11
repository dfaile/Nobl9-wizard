# Nobl9 Wizard - Terraform Outputs
# This file defines all outputs from the Terraform configuration

output "api_gateway_url" {
  description = "URL of the API Gateway endpoint"
  value       = "${aws_api_gateway_deployment.nobl9_wizard.invoke_url}/api"
}

output "api_gateway_create_project_url" {
  description = "URL of the create-project API endpoint"
  value       = "${aws_api_gateway_deployment.nobl9_wizard.invoke_url}/api/create-project"
}

output "frontend_website_url" {
  description = "URL of the S3 website hosting the frontend"
  value       = aws_s3_bucket_website_configuration.frontend_bucket_website.website_endpoint
}

output "frontend_website_domain" {
  description = "Domain name of the S3 website"
  value       = aws_s3_bucket_website_configuration.frontend_bucket_website.website_domain
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.nobl9_wizard.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.nobl9_wizard.arn
}

output "lambda_invoke_arn" {
  description = "Invocation ARN of the Lambda function"
  value       = aws_lambda_function.nobl9_wizard.invoke_arn
}

output "lambda_execution_role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend_bucket.id
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend_bucket.arn
}

output "lambda_bucket_name" {
  description = "Name of the S3 bucket storing Lambda function code"
  value       = aws_s3_bucket.lambda_bucket.id
}

output "lambda_bucket_arn" {
  description = "ARN of the S3 bucket storing Lambda function code"
  value       = aws_s3_bucket.lambda_bucket.arn
}

output "kms_key_arn" {
  description = "ARN of the KMS key used for encrypting credentials"
  value       = aws_kms_key.nobl9_credentials.arn
}

output "kms_key_id" {
  description = "ID of the KMS key used for encrypting credentials"
  value       = aws_kms_key.nobl9_credentials.key_id
}

output "kms_key_alias" {
  description = "Alias of the KMS key used for encrypting credentials"
  value       = aws_kms_alias.nobl9_credentials.name
}

output "parameter_store_client_id_name" {
  description = "Parameter Store name for Nobl9 Client ID"
  value       = aws_ssm_parameter.nobl9_client_id.name
}

output "parameter_store_client_secret_name" {
  description = "Parameter Store name for Nobl9 Client Secret"
  value       = aws_ssm_parameter.nobl9_client_secret.name
}

output "cloudwatch_log_group_name" {
  description = "Name of the CloudWatch log group for Lambda function"
  value       = aws_cloudwatch_log_group.lambda_function.name
}

output "cloudwatch_dashboard_name" {
  description = "Name of the CloudWatch dashboard"
  value       = aws_cloudwatch_dashboard.nobl9_wizard.dashboard_name
}

output "api_gateway_rest_api_id" {
  description = "ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.nobl9_wizard.id
}

output "api_gateway_rest_api_name" {
  description = "Name of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.nobl9_wizard.name
}

output "api_gateway_stage_name" {
  description = "Name of the API Gateway stage"
  value       = aws_api_gateway_deployment.nobl9_wizard.stage_name
}

output "cloudwatch_alarm_lambda_errors_arn" {
  description = "ARN of the CloudWatch alarm for Lambda errors"
  value       = aws_cloudwatch_metric_alarm.lambda_errors.arn
}

output "cloudwatch_alarm_api_gateway_5xx_errors_arn" {
  description = "ARN of the CloudWatch alarm for API Gateway 5XX errors"
  value       = aws_cloudwatch_metric_alarm.api_gateway_5xx_errors.arn
}

output "deployment_summary" {
  description = "Summary of the deployed infrastructure"
  value = {
    project_name     = var.project_name
    environment      = var.environment
    aws_region       = var.aws_region
    api_endpoint     = "${aws_api_gateway_deployment.nobl9_wizard.invoke_url}/api"
    frontend_url     = aws_s3_bucket_website_configuration.frontend_bucket_website.website_endpoint
    lambda_function  = aws_lambda_function.nobl9_wizard.function_name
    kms_key_alias    = aws_kms_alias.nobl9_credentials.name
    log_group        = aws_cloudwatch_log_group.lambda_function.name
    dashboard        = aws_cloudwatch_dashboard.nobl9_wizard.dashboard_name
  }
} 