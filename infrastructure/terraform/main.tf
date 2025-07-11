# Nobl9 Wizard - Terraform Infrastructure Configuration
# This file defines all AWS resources for the serverless Nobl9 onboarding application

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  required_version = ">= 1.5.0"
}

# Configure AWS Provider
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = var.owner
    }
  }
}

# Random resources for unique naming
resource "random_pet" "lambda_bucket_name" {
  prefix = "nobl9-wizard-lambda"
  length = 2
}

resource "random_pet" "frontend_bucket_name" {
  prefix = "nobl9-wizard-frontend"
  length = 2
}

# S3 Bucket for Lambda function code
resource "aws_s3_bucket" "lambda_bucket" {
  bucket = random_pet.lambda_bucket_name.id
  force_destroy = true
}

resource "aws_s3_bucket_acl" "lambda_bucket_acl" {
  bucket = aws_s3_bucket.lambda_bucket.id
  acl    = "private"
}

resource "aws_s3_bucket_versioning" "lambda_bucket_versioning" {
  bucket = aws_s3_bucket.lambda_bucket.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 Bucket for frontend hosting
resource "aws_s3_bucket" "frontend_bucket" {
  bucket = random_pet.frontend_bucket_name.id
  force_destroy = true
}

resource "aws_s3_bucket_acl" "frontend_bucket_acl" {
  bucket = aws_s3_bucket.frontend_bucket.id
  acl    = "public-read"
}

resource "aws_s3_bucket_website_configuration" "frontend_bucket_website" {
  bucket = aws_s3_bucket.frontend_bucket.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# S3 Bucket Policy for frontend (public read access)
resource "aws_s3_bucket_policy" "frontend_bucket_policy" {
  bucket = aws_s3_bucket.frontend_bucket.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.frontend_bucket.arn}/*"
      },
    ]
  })
}

# CORS configuration for frontend bucket
resource "aws_s3_bucket_cors_configuration" "frontend_bucket_cors" {
  bucket = aws_s3_bucket.frontend_bucket.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# KMS Key for encrypting Nobl9 credentials
resource "aws_kms_key" "nobl9_credentials" {
  description             = "KMS key for encrypting Nobl9 API credentials"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Enable IAM User Permissions"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      {
        Sid    = "Allow Lambda to use the key"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "nobl9_credentials" {
  name          = "alias/nobl9-wizard-credentials"
  target_key_id = aws_kms_key.nobl9_credentials.key_id
}

# Parameter Store parameters for Nobl9 credentials
resource "aws_ssm_parameter" "nobl9_client_id" {
  name        = "/nobl9-wizard/client-id"
  description = "Nobl9 API Client ID"
  type        = "SecureString"
  value       = var.nobl9_client_id
  key_id      = aws_kms_key.nobl9_credentials.arn

  lifecycle {
    ignore_changes = [value]
  }
}

resource "aws_ssm_parameter" "nobl9_client_secret" {
  name        = "/nobl9-wizard/client-secret"
  description = "Nobl9 API Client Secret"
  type        = "SecureString"
  value       = var.nobl9_client_secret
  key_id      = aws_kms_key.nobl9_credentials.arn

  lifecycle {
    ignore_changes = [value]
  }
}

# Lambda function code archive
data "archive_file" "lambda_function" {
  type        = "zip"
  source_file = "${path.module}/../../cmd/lambda/bootstrap"
  output_path = "${path.module}/lambda.zip"
}

# S3 object for Lambda function code
resource "aws_s3_object" "lambda_function" {
  bucket = aws_s3_bucket.lambda_bucket.id
  key    = "lambda-${data.archive_file.lambda_function.output_md5}.zip"
  source = data.archive_file.lambda_function.output_path
  etag   = filemd5(data.archive_file.lambda_function.output_path)
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  name = "${var.project_name}-lambda-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for Lambda execution
resource "aws_iam_role_policy" "lambda_execution_policy" {
  name = "${var.project_name}-lambda-execution-policy"
  role = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameter"
        ]
        Resource = [
          aws_ssm_parameter.nobl9_client_id.arn,
          aws_ssm_parameter.nobl9_client_secret.arn
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.nobl9_credentials.arn
        Condition = {
          StringEquals = {
            "kms:ViaService" = "ssm.${var.aws_region}.amazonaws.com"
          }
        }
      }
    ]
  })
}

# CloudWatch Log Group for Lambda function
resource "aws_cloudwatch_log_group" "lambda_function" {
  name              = "/aws/lambda/${aws_lambda_function.nobl9_wizard.function_name}"
  retention_in_days = var.log_retention_days
}

# Lambda function
resource "aws_lambda_function" "nobl9_wizard" {
  function_name = "${var.project_name}-api"
  description   = "Nobl9 Wizard API Lambda function"
  role          = aws_iam_role.lambda_execution.arn
  handler       = "bootstrap"
  runtime       = "provided.al2"

  s3_bucket = aws_s3_bucket.lambda_bucket.id
  s3_key    = aws_s3_object.lambda_function.key

  source_code_hash = data.archive_file.lambda_function.output_base64sha256

  timeout     = var.lambda_timeout
  memory_size = var.lambda_memory_size

  environment {
    variables = {
      NOBL9_CLIENT_ID_PARAM_NAME     = aws_ssm_parameter.nobl9_client_id.name
      NOBL9_CLIENT_SECRET_PARAM_NAME = aws_ssm_parameter.nobl9_client_secret.name
      NOBL9_SKIP_TLS_VERIFY          = var.nobl9_skip_tls_verify
    }
  }

  depends_on = [
    aws_iam_role_policy.lambda_execution_policy,
    aws_cloudwatch_log_group.lambda_function
  ]
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "nobl9_wizard" {
  name        = "${var.project_name}-api"
  description = "Nobl9 Wizard API Gateway"

  endpoint_configuration {
    types = ["REGIONAL"]
  }
}

# API Gateway Resource for /api
resource "aws_api_gateway_resource" "api" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  parent_id   = aws_api_gateway_rest_api.nobl9_wizard.root_resource_id
  path_part   = "api"
}

# API Gateway Resource for /api/create-project
resource "aws_api_gateway_resource" "create_project" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  parent_id   = aws_api_gateway_resource.api.id
  path_part   = "create-project"
}

# API Gateway Method for POST /api/create-project
resource "aws_api_gateway_method" "create_project_post" {
  rest_api_id   = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id   = aws_api_gateway_resource.create_project.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway Method for OPTIONS /api/create-project (CORS)
resource "aws_api_gateway_method" "create_project_options" {
  rest_api_id   = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id   = aws_api_gateway_resource.create_project.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway Integration for POST /api/create-project
resource "aws_api_gateway_integration" "create_project_post" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_post.http_method

  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = aws_lambda_function.nobl9_wizard.invoke_arn
}

# API Gateway Integration for OPTIONS /api/create-project
resource "aws_api_gateway_integration" "create_project_options" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_options.http_method

  type = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway Method Response for POST
resource "aws_api_gateway_method_response" "create_project_post" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_post.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

# API Gateway Method Response for OPTIONS
resource "aws_api_gateway_method_response" "create_project_options" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Headers" = true
  }
}

# API Gateway Integration Response for POST
resource "aws_api_gateway_integration_response" "create_project_post" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_post.http_method
  status_code = aws_api_gateway_method_response.create_project_post.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST, OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
  }
}

# API Gateway Integration Response for OPTIONS
resource "aws_api_gateway_integration_response" "create_project_options" {
  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  resource_id = aws_api_gateway_resource.create_project.id
  http_method = aws_api_gateway_method.create_project_options.http_method
  status_code = aws_api_gateway_method_response.create_project_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Origin" = "'*'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST, OPTIONS'"
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
  }
}

# Lambda permission for API Gateway
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.nobl9_wizard.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.nobl9_wizard.execution_arn}/*/*"
}

# API Gateway Deployment
resource "aws_api_gateway_deployment" "nobl9_wizard" {
  depends_on = [
    aws_api_gateway_integration.create_project_post,
    aws_api_gateway_integration.create_project_options,
    aws_api_gateway_integration_response.create_project_post,
    aws_api_gateway_integration_response.create_project_options
  ]

  rest_api_id = aws_api_gateway_rest_api.nobl9_wizard.id
  stage_name  = var.environment

  lifecycle {
    create_before_destroy = true
  }
}

# CloudWatch Dashboard
resource "aws_cloudwatch_dashboard" "nobl9_wizard" {
  dashboard_name = "${var.project_name}-dashboard"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/Lambda", "Invocations", "FunctionName", aws_lambda_function.nobl9_wizard.function_name],
            [".", "Errors", ".", "."],
            [".", "Duration", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "Lambda Function Metrics"
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiName", aws_api_gateway_rest_api.nobl9_wizard.name],
            [".", "5XXError", ".", "."],
            [".", "4XXError", ".", "."]
          ]
          period = 300
          stat   = "Sum"
          region = var.aws_region
          title  = "API Gateway Metrics"
        }
      }
    ]
  })
}

# CloudWatch Alarms
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "${var.project_name}-lambda-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors Lambda function errors"
  alarm_actions       = var.alarm_actions

  dimensions = {
    FunctionName = aws_lambda_function.nobl9_wizard.function_name
  }
}

resource "aws_cloudwatch_metric_alarm" "api_gateway_5xx_errors" {
  alarm_name          = "${var.project_name}-api-gateway-5xx-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApiGateway"
  period              = "300"
  statistic           = "Sum"
  threshold           = "0"
  alarm_description   = "This metric monitors API Gateway 5XX errors"
  alarm_actions       = var.alarm_actions

  dimensions = {
    ApiName = aws_api_gateway_rest_api.nobl9_wizard.name
  }
}

# Data sources
data "aws_caller_identity" "current" {} 