# Nobl9 Wizard Lambda Function

This directory contains the AWS Lambda function for the Nobl9 Wizard application. The function handles project creation and user role assignment requests from the frontend.

## Overview

The Lambda function provides a serverless backend for the Nobl9 onboarding application, replacing the traditional HTTP server with a cloud-native solution. It integrates with AWS services for secure credential management and provides the same functionality as the original Go backend.

## Features

- **Serverless Architecture**: Runs on AWS Lambda with automatic scaling
- **CSRF Protection**: Validates cryptographically secure tokens to prevent cross-site request forgery
- **Input Sanitization**: Comprehensive validation and sanitization of all user inputs
- **Security Logging**: Structured security event logging for monitoring and alerting
- **Secure Credential Management**: Uses AWS KMS and Parameter Store for Nobl9 API credentials
- **CORS Support**: Handles cross-origin requests from the S3-hosted frontend
- **Error Handling**: Comprehensive error handling and logging
- **Configurable Security**: CSRF enforcement can be enabled/disabled per environment

## Prerequisites

- Go 1.24 or later
- AWS CLI configured with appropriate permissions
- Nobl9 API credentials (Client ID and Client Secret)

## Building the Function

### Quick Build

```bash
# Make the build script executable (if not already done)
chmod +x build.sh

# Run the build script
./build.sh
```

### Manual Build

```bash
# Download dependencies
go mod download

# Build for Linux (required for AWS Lambda)
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go

# Create deployment package
zip lambda.zip bootstrap
```

## Environment Variables

The Lambda function requires the following environment variables:

| Variable | Description | Required |
|----------|-------------|----------|
| `NOBL9_CLIENT_ID_PARAM_NAME` | Parameter Store name for Nobl9 Client ID | Yes |
| `NOBL9_CLIENT_SECRET_PARAM_NAME` | Parameter Store name for Nobl9 Client Secret | Yes |
| `ENFORCE_CSRF_TOKENS` | Enable CSRF token enforcement (set to "true" for production) | No |
| `NOBL9_SKIP_TLS_VERIFY` | Skip TLS verification (set to "true" if needed) | No |

## AWS Services Integration

### Parameter Store Setup

Store your Nobl9 credentials in AWS Systems Manager Parameter Store:

```bash
# Store Client ID (encrypted)
aws ssm put-parameter \
    --name "/nobl9-wizard/client-id" \
    --value "your-nobl9-client-id" \
    --type "SecureString" \
    --description "Nobl9 API Client ID"

# Store Client Secret (encrypted)
aws ssm put-parameter \
    --name "/nobl9-wizard/client-secret" \
    --value "your-nobl9-client-secret" \
    --type "SecureString" \
    --description "Nobl9 API Client Secret"
```

### KMS Encryption (Optional)

For additional security, you can encrypt the parameters with KMS:

```bash
# Create a KMS key (if you don't have one)
aws kms create-key --description "Nobl9 Wizard encryption key"

# Encrypt and store credentials
aws ssm put-parameter \
    --name "/nobl9-wizard/client-id" \
    --value "encrypted-client-id" \
    --type "String" \
    --description "KMS-encrypted Nobl9 API Client ID"

aws ssm put-parameter \
    --name "/nobl9-wizard/client-secret" \
    --value "encrypted-client-secret" \
    --type "String" \
    --description "KMS-encrypted Nobl9 API Client Secret"
```

## IAM Permissions

The Lambda execution role requires the following permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "ssm:GetParameter"
            ],
            "Resource": [
                "arn:aws:ssm:*:*:parameter/nobl9-wizard/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "kms:Decrypt"
            ],
            "Resource": [
                "arn:aws:kms:*:*:key/*"
            ],
            "Condition": {
                "StringEquals": {
                    "kms:ViaService": "ssm.*.amazonaws.com"
                }
            }
        }
    ]
}
```

## API Endpoints

The Lambda function handles the following API Gateway endpoints with CSRF protection:

### GET /health

Health check endpoint for monitoring.

**Response:**
```json
{
    "status": "healthy",
    "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /api/create-project

Creates a new Nobl9 project and assigns user roles.

**Headers:**
```
Content-Type: application/json
X-CSRF-Token: <csrf-token>
X-Requested-With: XMLHttpRequest
```

**Request Body:**
```json
{
    "appID": "my-project",
    "description": "Optional project description",
    "userGroups": [
        {
            "userIds": "user1@example.com,user2@example.com",
            "role": "project-owner"
        },
        {
            "userIds": "user3@example.com",
            "role": "project-viewer"
        }
    ]
}
```

**Response:**
```json
{
    "success": true,
    "message": "Project 'my-project' created successfully with 3 user role assignments"
}
```

## Deployment

### Using AWS CLI

```bash
# Update the Lambda function
aws lambda update-function-code \
    --function-name nobl9-wizard-api \
    --zip-file fileb://lambda.zip

# Update environment variables
aws lambda update-function-configuration \
    --function-name nobl9-wizard-api \
    --environment Variables='{
        "NOBL9_CLIENT_ID_PARAM_NAME":"/nobl9-wizard/client-id",
        "NOBL9_CLIENT_SECRET_PARAM_NAME":"/nobl9-wizard/client-secret"
    }'
```

### Using Terraform/CloudFormation

The function is deployed as part of the infrastructure templates in the root directory.

## Testing

### Local Testing

You can test the function locally using the AWS Lambda Runtime Interface Emulator:

```bash
# Install the emulator
docker pull public.ecr.aws/lambda/provided:al2

# Run the function locally
docker run -p 9000:8080 \
    -v $(pwd):/var/task \
    public.ecr.aws/lambda/provided:al2 \
    bootstrap

# Test with curl
curl -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
    -d '{
        "httpMethod": "POST",
        "path": "/api/create-project",
        "body": "{\"appID\":\"test-project\",\"userGroups\":[{\"userIds\":\"test@example.com\",\"role\":\"project-owner\"}]}"
    }'
```

### AWS Testing

Test the deployed function using the AWS CLI:

```bash
aws lambda invoke \
    --function-name nobl9-wizard-api \
    --payload '{
        "httpMethod": "POST",
        "path": "/api/create-project",
        "body": "{\"appID\":\"test-project\",\"userGroups\":[{\"userIds\":\"test@example.com\",\"role\":\"project-owner\"}]}"
    }' \
    response.json

cat response.json
```

## Monitoring and Logging

- **CloudWatch Logs**: All function logs are automatically sent to CloudWatch
- **Metrics**: Lambda provides built-in metrics for invocations, duration, and errors
- **X-Ray**: Enable X-Ray tracing for detailed request tracing

## Troubleshooting

### Common Issues

1. **Permission Denied**: Ensure the Lambda execution role has the required IAM permissions
2. **Parameter Not Found**: Verify the Parameter Store parameters exist and are accessible
3. **KMS Decryption Failed**: Check KMS key permissions and encryption context
4. **CSRF Token Validation Failed**: Check token format and generation in frontend
5. **Security Event Logging**: Monitor CloudWatch logs for security events
6. **Timeout**: Increase the Lambda timeout if processing large numbers of users

### Debug Mode

Enable debug logging and CSRF enforcement:

```bash
# Enable CSRF enforcement (recommended for production)
aws lambda update-function-configuration \
    --function-name nobl9-wizard-api \
    --environment Variables='{
        "ENFORCE_CSRF_TOKENS":"true",
        "LOG_LEVEL":"DEBUG"
    }'

# Or disable CSRF enforcement (warning mode only - for development)
aws lambda update-function-configuration \
    --function-name nobl9-wizard-api \
    --environment Variables='{
        "ENFORCE_CSRF_TOKENS":"false",
        "LOG_LEVEL":"DEBUG"
    }'
```

## Security Considerations

- **CSRF Protection**: Validates cryptographically secure tokens to prevent cross-site request forgery
- **Input Sanitization**: Comprehensive validation and sanitization of all user inputs
- **Security Logging**: Structured security event logging for monitoring and alerting
- **CORS Headers**: Properly configured for frontend integration with security headers
- **Credential Encryption**: All credentials are encrypted at rest using AWS KMS
- **Parameter Store**: Parameters are retrieved securely from AWS Systems Manager
- **Input Validation**: Prevents injection attacks and validates all inputs
- **Configurable Enforcement**: CSRF protection can be enabled/disabled per environment
- **TLS Verification**: Can be disabled for testing environments if needed

## Performance

- **Cold Start**: ~100-200ms for Go Lambda functions
- **Memory**: Recommended 512MB for optimal performance
- **Timeout**: Default 30 seconds, configurable up to 15 minutes
- **Concurrency**: Automatic scaling based on request volume 