# Nobl9 Wizard Infrastructure

This directory contains Infrastructure as Code (IaC) templates for deploying the Nobl9 Wizard serverless application on AWS. Both Terraform and CloudFormation templates are provided to give you deployment flexibility.

## Overview

The infrastructure creates a complete serverless environment for the Nobl9 onboarding application:

- **Lambda Function**: Go-based API backend with secure credential management
- **API Gateway**: RESTful API with AWS_IAM authorization and CORS support
- **Cognito Identity Pool**: Browser-based IAM credentials for frontend authentication
- **S3 Buckets**: Frontend hosting and Lambda code storage
- **KMS**: Encryption for sensitive credentials
- **Parameter Store**: Secure storage for Nobl9 API credentials
- **CloudWatch**: Monitoring, logging, and alerting
- **IAM**: Least-privilege access policies for Lambda and frontend

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   API Gateway   │    │   Lambda        │
│   (S3 Website)  │◄──►│   (REST API)    │◄──►│   Function      │
│   + Cognito     │    │   + AWS_IAM     │    │   + KMS         │
│   Identity Pool │    │   Auth          │    │   + Parameter   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │   Parameter     │
                                              │   Store + KMS   │
                                              │   (Credentials) │
                                              └─────────────────┘
                                                       │
                                                       ▼
                                              ┌─────────────────┐
                                              │   Nobl9 API     │
                                              │   (External)    │
                                              └─────────────────┘
```

## Prerequisites

### AWS CLI
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
```

### Terraform (for Terraform deployment)
```bash
# Install Terraform
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install terraform

# Verify installation
terraform version
```

### AWS CloudFormation (for CloudFormation deployment)
CloudFormation is available through the AWS CLI or AWS Console.

## Deployment Options

### Option 1: Terraform Deployment (Recommended)

Terraform provides better state management, dependency handling, and resource lifecycle management.

#### Quick Start

1. **Navigate to Terraform directory:**
   ```bash
   cd infrastructure/terraform
   ```

2. **Copy and configure variables:**
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with your values
   ```

3. **Initialize Terraform:**
   ```bash
   terraform init
   ```

4. **Plan the deployment:**
   ```bash
   terraform plan
   ```

5. **Deploy the infrastructure:**
   ```bash
   terraform apply
   ```

6. **View outputs:**
   ```bash
   terraform output
   ```

#### Advanced Terraform Usage

**Workspace Management:**
```bash
# Create different environments
terraform workspace new dev
terraform workspace new staging
terraform workspace new prod

# Switch between environments
terraform workspace select prod
```

**Targeted Deployment:**
```bash
# Deploy only specific resources
terraform apply -target=aws_lambda_function.nobl9_wizard
```

**Import Existing Resources:**
```bash
# Import existing resources into Terraform state
terraform import aws_s3_bucket.frontend_bucket my-existing-bucket
```

### Option 2: CloudFormation Deployment

CloudFormation is AWS-native and integrates well with AWS services.

#### Quick Start

1. **Navigate to CloudFormation directory:**
   ```bash
   cd infrastructure/cloudformation
   ```

2. **Update parameters:**
   ```bash
   # Edit parameters.json with your values
   ```

3. **Deploy via AWS CLI:**
   ```bash
   aws cloudformation create-stack \
     --stack-name nobl9-wizard \
     --template-body file://template.yaml \
     --parameters file://parameters.json \
     --capabilities CAPABILITY_NAMED_IAM
   ```

4. **Monitor deployment:**
   ```bash
   aws cloudformation describe-stacks --stack-name nobl9-wizard
   ```

5. **View outputs:**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name nobl9-wizard \
     --query 'Stacks[0].Outputs'
   ```

#### Advanced CloudFormation Usage

**Update Stack:**
```bash
aws cloudformation update-stack \
  --stack-name nobl9-wizard \
  --template-body file://template.yaml \
  --parameters file://parameters.json \
  --capabilities CAPABILITY_NAMED_IAM
```

**Delete Stack:**
```bash
aws cloudformation delete-stack --stack-name nobl9-wizard
```

**Validate Template:**
```bash
aws cloudformation validate-template --template-body file://template.yaml
```

## Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `nobl9_client_id` | Nobl9 API Client ID | `your-client-id` |
| `nobl9_client_secret` | Nobl9 API Client Secret | `your-client-secret` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `aws_region` | `us-east-1` | AWS region for deployment |
| `project_name` | `nobl9-wizard` | Project name for resource naming |
| `environment` | `prod` | Environment name |
| `lambda_timeout` | `30` | Lambda function timeout (seconds) |
| `lambda_memory_size` | `512` | Lambda function memory (MB) |
| `log_retention_days` | `30` | CloudWatch log retention |
| `enable_cloudwatch_dashboard` | `true` | Enable monitoring dashboard |
| `enable_cloudwatch_alarms` | `true` | Enable monitoring alarms |

## Security Features

### Credential Management
- **KMS Encryption**: All credentials are encrypted using AWS KMS
- **Parameter Store**: Secure storage with automatic encryption
- **IAM Policies**: Least-privilege access for Lambda function
- **No Hardcoded Secrets**: All sensitive data stored securely

### Network Security
- **Private Lambda**: Lambda function runs in private VPC context
- **API Gateway Security**: Regional endpoint with CORS configuration
- **S3 Security**: Frontend bucket with minimal public access

### Monitoring & Alerting
- **CloudWatch Logs**: Comprehensive logging for all components
- **CloudWatch Alarms**: Automatic alerting for errors and issues
- **CloudWatch Dashboard**: Real-time monitoring dashboard

## Resource Costs

### Estimated Monthly Costs (us-east-1)

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 1M requests/month | ~$0.20 |
| API Gateway | 1M requests/month | ~$3.50 |
| S3 | 1GB storage + requests | ~$0.03 |
| CloudWatch | Basic monitoring | ~$0.50 |
| KMS | 1 key | ~$1.00 |
| Parameter Store | 2 parameters | ~$0.05 |
| Cognito | Identity Pool usage | ~$0.50 |
| **Total** | | **~$5.78/month** |

*Costs are estimates and may vary based on actual usage.*

## Troubleshooting

### Common Issues

**Terraform State Issues:**
```bash
# Refresh state
terraform refresh

# Import missing resources
terraform import aws_resource.name resource-id

# Recreate state
terraform init -reconfigure
```

**CloudFormation Rollback:**
```bash
# Check stack events
aws cloudformation describe-stack-events --stack-name nobl9-wizard

# Continue rollback
aws cloudformation continue-update-rollback --stack-name nobl9-wizard
```

**Lambda Function Issues:**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/nobl9-wizard-api --follow

# Test Lambda function
aws lambda invoke --function-name nobl9-wizard-api response.json
```

**API Gateway Issues:**
```bash
# Test API endpoint (requires IAM authentication)
curl -X POST https://your-api-gateway-url/api/create-project \
  -H "Content-Type: application/json" \
  -H "Authorization: AWS4-HMAC-SHA256 Credential=..." \
  -d '{"appID":"test","userGroups":[{"userIds":"test@example.com","role":"project-owner"}]}'
```

### Debug Mode

Enable debug logging for troubleshooting:

**Terraform:**
```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform.log
terraform apply
```

**CloudFormation:**
```bash
# Enable detailed logging in template
EnableApiGatewayLogging: true
ApiGatewayLogLevel: INFO
```

## Maintenance

### Updates and Upgrades

**Terraform:**
```bash
# Update providers
terraform init -upgrade

# Plan and apply updates
terraform plan
terraform apply
```

**CloudFormation:**
```bash
# Update stack
aws cloudformation update-stack \
  --stack-name nobl9-wizard \
  --template-body file://template.yaml \
  --parameters file://parameters.json
```

### Backup and Recovery

**Terraform State Backup:**
```bash
# Use remote state storage
terraform init -backend-config="bucket=my-terraform-state"
```

**CloudFormation Stack Backup:**
```bash
# Export stack template
aws cloudformation get-template --stack-name nobl9-wizard > backup-template.yaml
```

## Best Practices

### Security
- Rotate KMS keys regularly
- Use least-privilege IAM policies
- Enable CloudTrail for audit logging
- Regularly review and update security groups

### Cost Optimization
- Monitor CloudWatch metrics for usage patterns
- Set up billing alerts
- Use S3 lifecycle policies for old logs
- Consider reserved concurrency for Lambda

### Performance
- Monitor Lambda cold start times
- Optimize Lambda function code
- Use API Gateway caching where appropriate
- Monitor API Gateway throttling

### Monitoring
- Set up comprehensive CloudWatch alarms
- Use CloudWatch dashboards for visualization
- Enable X-Ray tracing for debugging
- Monitor error rates and response times

## Support

For issues and questions:

1. Check the troubleshooting section above
2. Review CloudWatch logs for detailed error information
3. Consult AWS documentation for service-specific issues
4. Open an issue in the project repository

## Contributing

When contributing to infrastructure templates:

1. Test changes in a development environment first
2. Update documentation for any new variables or resources
3. Follow the existing naming conventions
4. Include appropriate tags for all resources
5. Test both Terraform and CloudFormation deployments 