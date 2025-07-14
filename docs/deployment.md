# Deployment Guide: Nobl9 AWS Serverless Onboarding App

This guide provides comprehensive instructions for deploying the Nobl9 AWS Serverless Onboarding App to AWS using either Terraform or CloudFormation.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Pre-Deployment Setup](#pre-deployment-setup)
4. [Infrastructure Deployment](#infrastructure-deployment)
5. [Application Deployment](#application-deployment)
6. [Post-Deployment Configuration](#post-deployment-configuration)
7. [Verification and Testing](#verification-and-testing)
8. [Monitoring Setup](#monitoring-setup)
9. [Troubleshooting](#troubleshooting)
10. [Maintenance and Updates](#maintenance-and-updates)

## Prerequisites

### Required Tools

- **AWS CLI v2** (latest version)
- **Go 1.21+** for Lambda function development
- **Node.js 18+** for React frontend
- **Git** for version control
- **Terraform 1.0+** (for Terraform deployment)
- **jq** for JSON processing (optional but recommended)

### AWS Account Requirements

- AWS account with appropriate permissions
- AWS region selected (recommended: `us-east-1`, `us-west-2`, or `eu-west-1`)
- Sufficient service quotas for Lambda, API Gateway, and other services

### Required AWS Permissions

Your AWS user/role must have permissions for:
- **Lambda**: Create, update, delete functions and layers
- **API Gateway**: Create and manage REST APIs (configured for public access)
- **S3**: Create buckets, manage objects, configure static website hosting
- **KMS**: Create and manage encryption keys
- **IAM**: Create roles, policies, and instance profiles
- **CloudWatch**: Create log groups, metrics, alarms, and dashboards
- **Systems Manager Parameter Store**: Create and manage parameters
- **CloudFormation**: Create and manage stacks (if using CloudFormation)

**Note**: The API Gateway is configured for public access (`authorization = "NONE"`). For production environments, consider implementing additional authentication mechanisms.

## Architecture Overview

The application consists of the following AWS resources:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   S3 Frontend   │    │  API Gateway    │    │  Lambda Function│
│   (Static Site) │◄──►│   (REST API)    │◄──►│   (Go Runtime)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   CloudWatch    │    │  Parameter Store│
                       │  (Logs/Metrics) │    │ (Credentials)   │
                       └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   KMS Key       │    │  Nobl9 API      │
                       │ (Encryption)    │    │ (External)      │
                       └─────────────────┘    └─────────────────┘
```

## Pre-Deployment Setup

### 1. Clone and Prepare Repository

```bash
# Clone the repository
git clone https://github.com/your-org/Nobl9-wizard.git
cd Nobl9-wizard

# Verify the structure
ls -la
```

### 2. Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"

# Verify configuration
aws sts get-caller-identity
```

### 3. Prepare Nobl9 Credentials

Before deployment, you need your Nobl9 API credentials:

```bash
# Store credentials in Parameter Store (encrypted)
aws ssm put-parameter \
  --name "/nobl9-onboarding-app/client-id" \
  --value "your-nobl9-client-id" \
  --type "SecureString" \
  --description "Nobl9 API Client ID"

aws ssm put-parameter \
  --name "/nobl9-onboarding-app/client-secret" \
  --value "your-nobl9-client-secret" \
  --type "SecureString" \
  --description "Nobl9 API Client Secret"
```

### 4. Configure Deployment Variables

Create a configuration file for your deployment:

```bash
# For Terraform
cp infrastructure/terraform/terraform.tfvars.example infrastructure/terraform/terraform.tfvars

# Edit the variables file
nano infrastructure/terraform/terraform.tfvars
```

Example `terraform.tfvars`:
```hcl
aws_region = "us-east-1"
environment = "production"
project_name = "nobl9-onboarding"
domain_name = "your-domain.com"  # Optional
nobl9_org = "your-nobl9-org"
```

## Infrastructure Deployment

### Option A: Terraform Deployment (Recommended)

#### 1. Initialize Terraform

```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Verify providers
terraform providers
```

#### 2. Review Deployment Plan

```bash
# Generate and review the deployment plan
terraform plan -var-file="terraform.tfvars"

# Review the plan carefully, especially:
# - Resource names and tags
# - IAM permissions
# - KMS key configuration
# - S3 bucket settings
```

#### 3. Deploy Infrastructure

```bash
# Apply the configuration
terraform apply -var-file="terraform.tfvars"

# Confirm the deployment when prompted
# Type 'yes' to proceed
```

#### 4. Capture Outputs

```bash
# Get deployment outputs
terraform output

# Save outputs to a file for reference
terraform output -json > deployment-outputs.json
```

### Option B: CloudFormation Deployment

#### 1. Prepare Parameters

```bash
cd infrastructure/cloudformation

# Edit parameters file
nano parameters.json
```

Example `parameters.json`:
```json
[
  {
    "ParameterKey": "Environment",
    "ParameterValue": "production"
  },
  {
    "ParameterKey": "ProjectName",
    "ParameterValue": "nobl9-onboarding"
  },
  {
    "ParameterKey": "Nobl9Org",
    "ParameterValue": "your-nobl9-org"
  }
]
```

#### 2. Deploy CloudFormation Stack

```bash
# Create the stack
aws cloudformation create-stack \
  --stack-name nobl9-onboarding-app \
  --template-body file://template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for stack creation
aws cloudformation wait stack-create-complete \
  --stack-name nobl9-onboarding-app

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name nobl9-onboarding-app \
  --query 'Stacks[0].Outputs'
```

## Application Deployment

### 1. Build Lambda Function

```bash
# Navigate to Lambda directory
cd cmd/lambda

# Install dependencies
go mod tidy
go mod download

# Build for Linux (Lambda runtime)
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go

# Create deployment package
zip function.zip bootstrap

# Verify the package
ls -la function.zip
```

### 2. Deploy Lambda Function

```bash
# Update Lambda function code
aws lambda update-function-code \
  --function-name nobl9-onboarding-lambda \
  --zip-file fileb://function.zip

# Wait for update to complete
aws lambda wait function-updated \
  --function-name nobl9-onboarding-lambda

# Verify deployment
aws lambda get-function \
  --function-name nobl9-onboarding-lambda \
  --query 'Configuration.LastUpdateStatus'
```

### 3. Build and Deploy Frontend

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Deploy to S3 (use bucket name from infrastructure outputs)
aws s3 sync build/ s3://nobl9-wizard-frontend --delete

# Or use the deployment script with Cognito Identity Pool
./deploy.sh prod https://your-api-gateway-url.execute-api.region.amazonaws.com/prod $COGNITO_IDENTITY_POOL_ID us-east-1
```

### 4. Configure Environment Variables

```bash
# Set Lambda environment variables
aws lambda update-function-configuration \
  --function-name nobl9-onboarding-lambda \
  --environment Variables='{
    "NOBL9_CLIENT_ID_PARAM_NAME":"/nobl9-onboarding-app/client-id",
    "NOBL9_CLIENT_SECRET_PARAM_NAME":"/nobl9-onboarding-app/client-secret",
    "NOBL9_ORG":"your-nobl9-org"
  }'
```

### 5. Get Cognito Identity Pool ID for Frontend

After deploying the infrastructure, you need to retrieve the Cognito Identity Pool ID for frontend authentication:

```bash
# Get the Cognito Identity Pool ID from CloudFormation outputs
COGNITO_IDENTITY_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name nobl9-wizard \
  --query 'Stacks[0].Outputs[?OutputKey==`CognitoIdentityPoolId`].OutputValue' \
  --output text)

echo "Cognito Identity Pool ID: $COGNITO_IDENTITY_POOL_ID"
```

**Important**: Save this Cognito Identity Pool ID. It will be needed for frontend deployment.

## Post-Deployment Configuration

### 1. Update Frontend Configuration

The frontend configuration is automatically updated during deployment, but you can verify the settings:

```bash
# Edit the config file
nano frontend/src/config.ts
```

Ensure the API Gateway URL and Cognito Identity Pool ID are correct:
```typescript
export const config = {
  apiEndpoint: 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod',
  cognitoIdentityPoolId: 'your-identity-pool-id',
  awsRegion: 'us-east-1',
  // ... other settings
};
```

**Note**: The Cognito Identity Pool ID and AWS Region are automatically injected during deployment using the `./deploy.sh` script.

### 2. Configure Custom Domain (Optional)

If you have a custom domain:

```bash
# Request SSL certificate
aws acm request-certificate \
  --domain-name your-domain.com \
  --validation-method DNS

# Configure API Gateway custom domain
aws apigateway create-domain-name \
  --domain-name your-domain.com \
  --certificate-arn arn:aws:acm:region:account:certificate/certificate-id
```

### 3. Set Up CloudWatch Alarms

```bash
# Create Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name "nobl9-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:region:account:topic-name
```

## Verification and Testing

### 1. Test API Endpoints

```bash
# Test health check endpoint (requires IAM authentication)
# Note: This requires AWS credentials to sign the request
aws sigv4-sign-request \
  --region us-east-1 \
  --service execute-api \
  --method GET \
  --uri https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/health

# Expected response:
# {"status":"healthy","version":"1.0.0","timestamp":"2024-01-01T00:00:00Z"}

# Test CORS preflight
curl -X OPTIONS https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/api/create-project \
  -H "Origin: https://your-frontend-bucket.s3-website-region.amazonaws.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token"
```

### 2. Test Frontend

```bash
# Open the S3 website URL in a browser
open https://your-frontend-bucket.s3-website-region.amazonaws.com

# Test project creation flow
# 1. Enter a valid project name
# 2. Add user groups with roles
# 3. Submit the form
# 4. Verify success message
```

### 3. Test Nobl9 Integration

```bash
# Test with real Nobl9 credentials (requires IAM authentication)
# Note: This requires AWS credentials to sign the request
aws sigv4-sign-request \
  --region us-east-1 \
  --service execute-api \
  --method POST \
  --uri https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/api/create-project \
  --body '{
    "appID": "test-project-deployment",
    "description": "Test project created during deployment",
    "userGroups": [
      {
        "userIds": "your-email@company.com",
        "role": "project-owner"
      }
    ]
  }'
```

### 4. Verify Monitoring

```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/nobl9-onboarding-lambda --follow

# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=nobl9-onboarding-api \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Monitoring Setup

### 1. CloudWatch Dashboard

Create a comprehensive dashboard:

```bash
# Create dashboard JSON
cat > dashboard.json << 'EOF'
{
  "DashboardName": "Nobl9-Onboarding-Monitoring",
  "DashboardBody": "{\"widgets\":[...]}"
}
EOF

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name "Nobl9-Onboarding-Monitoring" \
  --dashboard-body file://dashboard.json
```

### 2. Log Analysis

Set up log insights queries for common issues:

```bash
# Example: Find Lambda errors
aws logs start-query \
  --log-group-name "/aws/lambda/nobl9-onboarding-lambda" \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time $(date +%s) \
  --query-string "fields @timestamp, @message | filter @message like /ERROR/ | sort @timestamp desc"
```

## Troubleshooting

### Common Issues

#### Lambda Function Errors

**Issue**: Function fails to start
```bash
# Check function configuration
aws lambda get-function --function-name nobl9-onboarding-lambda

# Check environment variables
aws lambda get-function-configuration --function-name nobl9-onboarding-lambda
```

**Issue**: Permission denied for KMS/Parameter Store
```bash
# Verify IAM role permissions
aws iam get-role-policy --role-name nobl9-onboarding-lambda-role --policy-name lambda-execution-policy
```

#### API Gateway Issues

**Issue**: CORS errors
```bash
# Check API Gateway CORS configuration
aws apigateway get-rest-api --rest-api-id your-api-id
```

**Issue**: 403 Forbidden
```bash
# Check API Gateway resource policy
aws apigateway get-rest-api-policy --rest-api-id your-api-id
```

#### S3 Frontend Issues

**Issue**: Website not accessible
```bash
# Check bucket configuration
aws s3api get-bucket-website --bucket your-frontend-bucket

# Check bucket policy
aws s3api get-bucket-policy --bucket your-frontend-bucket
```

### Debugging Commands

```bash
# Check all resources
aws resourcegroupstaggingapi get-resources --tag-filters Key=Project,Values=nobl9-onboarding

# Check costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

## Maintenance and Updates

### 1. Lambda Function Updates

```bash
# Build new version
cd cmd/lambda
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go
zip function.zip bootstrap

# Deploy update
aws lambda update-function-code \
  --function-name nobl9-onboarding-lambda \
  --zip-file fileb://function.zip
```

### 2. Frontend Updates

```bash
# Build and deploy
cd frontend
npm run build
aws s3 sync build/ s3://your-frontend-bucket --delete
```

### 3. Infrastructure Updates

```bash
# Terraform
cd infrastructure/terraform
terraform plan -var-file="terraform.tfvars"
terraform apply -var-file="terraform.tfvars"

# CloudFormation
aws cloudformation update-stack \
  --stack-name nobl9-onboarding-app \
  --template-body file://template.yaml \
  --parameters file://parameters.json
```

### 4. Credential Rotation

```bash
# Update credentials in Parameter Store
aws ssm put-parameter \
  --name "/nobl9-onboarding-app/client-id" \
  --value "new-client-id" \
  --type "SecureString" \
  --overwrite

aws ssm put-parameter \
  --name "/nobl9-onboarding-app/client-secret" \
  --value "new-client-secret" \
  --type "SecureString" \
  --overwrite
```

### 5. Backup and Recovery

```bash
# Export Terraform state
terraform state pull > terraform-state-backup.json

# Backup Parameter Store values
aws ssm get-parameter --name "/nobl9-onboarding-app/client-id" --with-decryption
aws ssm get-parameter --name "/nobl9-onboarding-app/client-secret" --with-decryption
```

## Cost Optimization

### 1. Monitor Usage

```bash
# Set up cost alerts
aws ce put-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorType": "DIMENSIONAL",
    "DimensionalValueCount": 10
  }'
```

### 2. Optimize Lambda

- Use provisioned concurrency for consistent performance
- Optimize function size and dependencies
- Monitor memory usage and adjust allocation

### 3. S3 Lifecycle Policies

```bash
# Set up lifecycle policy for logs
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-logs-bucket \
  --lifecycle-configuration file://lifecycle-policy.json
```

## Security Best Practices

### 1. Regular Security Audits

```bash
# Check IAM policies
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::account:role/nobl9-onboarding-lambda-role \
  --action-names lambda:InvokeFunction
```

### 2. KMS Key Rotation

```bash
# Enable automatic key rotation
aws kms enable-key-rotation --key-id your-kms-key-id
```

### 3. Network Security

- Use VPC endpoints for AWS services (if applicable)
- Configure security groups and NACLs
- Monitor CloudTrail logs for suspicious activity

## Support and Resources

### Documentation
- [AWS Lambda Developer Guide](https://docs.aws.amazon.com/lambda/)
- [AWS API Gateway Developer Guide](https://docs.aws.amazon.com/apigateway/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [CloudFormation User Guide](https://docs.aws.amazon.com/AWSCloudFormation/)

### Community Support
- GitHub Issues: [Repository Issues](https://github.com/your-org/Nobl9-wizard/issues)
- AWS Support: Available with AWS Support plans
- Nobl9 Documentation: [Nobl9 API Documentation](https://docs.nobl9.com/)

### Emergency Contacts
- AWS Support: Available through AWS Console
- Nobl9 Support: Contact through Nobl9 support channels
- Project Maintainers: Check repository for contact information 