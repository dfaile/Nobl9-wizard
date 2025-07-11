# Nobl9 AWS Serverless Onboarding App

A serverless web application for self-service Nobl9 project creation and user role assignment, built on AWS Lambda and S3.

## Overview

This application converts the existing Nobl9 onboarding tool from a Docker-based deployment to a native AWS serverless architecture. Users can create new projects in Nobl9 by specifying an appID (project name) and assigning users or groups with specific roles through a clean web interface.

## Architecture

- **Backend**: Go Lambda function using `provided.al2023` runtime
- **Frontend**: React application hosted on S3 with static website hosting
- **API**: AWS API Gateway with CORS support
- **Security**: AWS KMS for encrypted credential management
- **Monitoring**: CloudWatch for logging, metrics, and alarms
- **Infrastructure**: Terraform and CloudFormation templates for deployment

## Key Features

### 🚀 Serverless Architecture
- **Zero Server Management**: No EC2 instances to maintain or scale
- **Automatic Scaling**: Lambda functions scale from 0 to thousands of concurrent executions
- **High Availability**: Built on AWS managed services with 99.9%+ uptime
- **Event-Driven**: Pay only for actual usage with no idle costs

### 🔐 Secure Credential Management
- **AWS KMS Integration**: Nobl9 API credentials encrypted at rest and in transit
- **Parameter Store**: Secure storage of encrypted credentials in AWS Systems Manager
- **Runtime Decryption**: Credentials decrypted only when needed by Lambda function
- **Credential Rotation**: Support for secure credential updates without code changes
- **IAM Least Privilege**: Lambda function has minimal required permissions

### 💰 Cost Optimization
- **Pay-Per-Use Pricing**: Only pay for actual Lambda invocations and API requests
- **No Idle Costs**: No charges when the application is not being used
- **Predictable Billing**: Clear cost structure with monthly estimates under $15
- **Resource Optimization**: Automatic scaling eliminates over-provisioning

### 📊 Comprehensive Monitoring
- **CloudWatch Logs**: All Lambda function executions logged with structured data
- **Real-Time Metrics**: API Gateway requests, Lambda invocations, and error rates
- **Automated Alerting**: CloudWatch alarms for errors and performance issues
- **Custom Dashboards**: Centralized view of application health and performance
- **Error Tracking**: Detailed error logs with stack traces and context

### 🔌 Future-Ready API
- **RESTful Design**: Standard HTTP methods and status codes
- **JSON Payloads**: Consistent request/response formats
- **CORS Support**: Ready for web and mobile application integration
- **Versioning Support**: API versioning strategy for future updates
- **Documentation**: OpenAPI/Swagger specification for API consumers

### 🛠️ Infrastructure as Code
- **Terraform Support**: Declarative infrastructure configuration
- **CloudFormation Support**: AWS-native template format
- **Reproducible Deployments**: Consistent infrastructure across environments
- **Version Control**: Infrastructure changes tracked in git
- **Rollback Capability**: Easy reversion of infrastructure changes

## Prerequisites

### Required Tools
- **AWS CLI v2**: Configured with appropriate permissions for Lambda, API Gateway, S3, KMS, Parameter Store, and CloudWatch
- **Go 1.21+**: For Lambda function development and testing
- **Node.js 18+**: For React frontend development
- **Git**: For version control and cloning the repository

### Optional Tools
- **Terraform**: For infrastructure deployment (recommended)
- **CloudFormation**: Alternative infrastructure deployment option
- **Docker**: For local development environment (optional)

### AWS Permissions
Your AWS account needs the following permissions:
- **Lambda**: Create, update, and manage functions
- **API Gateway**: Create and manage REST APIs
- **S3**: Create buckets and manage objects
- **KMS**: Create and manage encryption keys
- **IAM**: Create roles and policies
- **CloudWatch**: Create log groups, metrics, and alarms
- **Systems Manager Parameter Store**: Store and retrieve parameters

## Installation and Setup

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/Nobl9-wizard.git
cd Nobl9-wizard
```

### 2. Install Dependencies

**Backend Dependencies:**
```bash
cd cmd/lambda
go mod tidy
go mod download
```

**Frontend Dependencies:**
```bash
cd frontend
npm install
```

### 3. Configure AWS Credentials
```bash
# Configure AWS CLI with your credentials
aws configure

# Or set environment variables
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="us-east-1"
```

### 4. Set Up Nobl9 Credentials
Store your Nobl9 API credentials securely in AWS Systems Manager Parameter Store:

```bash
# Store encrypted credentials in Parameter Store
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

# Set environment variables for the Lambda function
export NOBL9_CLIENT_ID_PARAM_NAME="/nobl9-onboarding-app/client-id"
export NOBL9_CLIENT_SECRET_PARAM_NAME="/nobl9-onboarding-app/client-secret"
```

### 5. Deploy Infrastructure

**Option A: Using Terraform (Recommended)**
```bash
cd infrastructure/terraform

# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Deploy the infrastructure
terraform apply

# Note the outputs for API Gateway URL and S3 website URL
terraform output
```

**Option B: Using CloudFormation**
```bash
# Deploy the CloudFormation stack
aws cloudformation create-stack \
  --stack-name nobl9-onboarding-app \
  --template-body file://infrastructure/cloudformation/template.yaml \
  --parameters file://infrastructure/cloudformation/parameters.json \
  --capabilities CAPABILITY_NAMED_IAM

# Wait for stack creation to complete
aws cloudformation wait stack-create-complete \
  --stack-name nobl9-onboarding-app

# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name nobl9-onboarding-app \
  --query 'Stacks[0].Outputs'
```

### 6. Deploy Application Code
```bash
# Build and deploy the Lambda function
cd cmd/lambda
./build.sh

# Or manually build and deploy
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go
zip function.zip bootstrap
aws lambda update-function-code --function-name nobl9-onboarding-lambda --zip-file fileb://function.zip
```

### 7. Deploy Frontend
```bash
# Build and deploy the React application
cd frontend
npm run build

# Deploy to S3 (bucket name from infrastructure outputs)
aws s3 sync build/ s3://your-frontend-bucket-name --delete

# Or use the provided deployment script
./deploy.sh
```

### 8. Verify Deployment
- **Frontend**: Visit the S3 website URL from infrastructure outputs
- **API**: Test the API Gateway endpoint with a sample request
- **Logs**: Check CloudWatch logs for any errors

### 9. Configure Monitoring (Optional)
```bash
# Set up CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name "nobl9-lambda-errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold
```

## Usage Guide

### Web Interface Usage

1. **Access the Application**: Navigate to the S3 website URL provided after deployment
2. **Create a New Project**:
   - Enter a unique project name (appID) - only letters, numbers, and hyphens allowed
   - Add an optional project description
   - Add user groups with their assigned roles
   - Review the project details in the confirmation dialog
   - Submit to create the project

3. **User Management**:
   - Add up to 8 users per project
   - Each user group must specify a role (Owner, Editor, Viewer)
   - Support for both email addresses and user IDs
   - Comma-separated lists for multiple users in a group

### API Usage

#### Create Project Endpoint

**Endpoint:** `POST /api/create-project`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "appID": "my-project",
  "description": "Optional project description",
  "userGroups": [
    {
      "userIds": "user@example.com,another@example.com",
      "role": "project-owner"
    },
    {
      "userIds": "user123",
      "role": "project-viewer"
    }
  ]
}
```

**Valid Roles:**
- `project-owner`: Full project access and management
- `project-editor`: Can edit project configurations and data
- `project-viewer`: Read-only access to project data

**Response Format:**
```json
{
  "success": true,
  "message": "Project 'my-project' created successfully with 2 user role assignments"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Project 'my-project' already exists"
}
```

#### Example API Calls

**Using curl:**
```bash
curl -X POST https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/api/create-project \
  -H "Content-Type: application/json" \
  -d '{
    "appID": "test-project",
    "description": "Test project created via API",
    "userGroups": [
      { "userIds": "admin@company.com", "role": "project-owner" },
      { "userIds": "viewer@company.com", "role": "project-viewer" }
    ]
  }'
```

**Using JavaScript:**
```javascript
const response = await fetch('https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/api/create-project', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    appID: 'my-project',
    description: 'Project created via JavaScript',
    userGroups: [
      { userIds: 'user@example.com', role: 'project-owner' }
    ]
  })
});

const result = await response.json();
console.log(result.message);
```

### Integration Examples

#### Python Integration
```python
import requests
import json

def create_nobl9_project(api_url, project_name, description, users):
    payload = {
        "appID": project_name,
        "description": description,
        "userGroups": users
    }
    
    response = requests.post(
        f"{api_url}/api/create-project",
        headers={"Content-Type": "application/json"},
        json=payload
    )
    
    return response.json()

# Usage
users = [
    {"userIds": "admin@company.com", "role": "project-owner"},
    {"userIds": "team@company.com", "role": "project-editor"}
]

result = create_nobl9_project(
    "https://your-api-gateway-url.execute-api.region.amazonaws.com/prod",
    "new-project",
    "Project created via Python integration",
    users
)
print(result)
```

#### Terraform Integration
```hcl
# Use the API Gateway URL as a data source
data "aws_api_gateway_rest_api" "nobl9_api" {
  name = "nobl9-onboarding-api"
}

output "api_url" {
  value = "https://${data.aws_api_gateway_rest_api.nobl9_api.id}.execute-api.${var.aws_region}.amazonaws.com/prod"
}
```

## Security

- **KMS Encryption**: All Nobl9 credentials are encrypted using AWS KMS
- **Parameter Store**: Encrypted credentials stored in AWS Systems Manager Parameter Store
- **IAM Least Privilege**: Lambda function has minimal required permissions
- **CORS Configuration**: Properly configured for S3-to-API-Gateway communication

## Monitoring

- **CloudWatch Logs**: All Lambda function executions are logged
- **CloudWatch Metrics**: API Gateway requests, Lambda invocations, and error rates
- **CloudWatch Alarms**: Automated alerting for errors and performance issues
- **CloudWatch Dashboard**: Centralized view of application health

## Cost Estimation

Typical monthly costs for moderate usage:
- Lambda: $1-5/month
- API Gateway: $1-3/month
- S3: $0.50-1/month
- CloudWatch: $1-2/month
- KMS: $1/month
- **Total: ~$5-12/month**

## Development

### Local Development
```bash
# Backend (Lambda)
cd cmd/lambda
go mod tidy
go mod download

# Test the Lambda function locally
go test -v

# Frontend
cd frontend
npm install
npm start
```

### Testing

#### Backend Testing (Lambda Function)

The Lambda function includes comprehensive unit tests covering validation, health checks, error handling, and response correctness.

**Run all tests:**
```bash
cd cmd/lambda
go test ./...
```

**Run tests with verbose output:**
```bash
go test -v
```

**Run tests with coverage:**
```bash
go test -cover
```

**Generate coverage report:**
```bash
go test -coverprofile=coverage.out
go tool cover -html=coverage.out -o coverage.html
```

**Test Results:**
- **Coverage**: 49.5% of statements
- **Test Categories**:
  - Input validation (project names, emails, roles)
  - Health check endpoint
  - Error handling and response formatting
  - Request routing and CORS support
  - AWS credential management

**Test Files:**
- `main_test.go`: Comprehensive unit tests for all Lambda function components

#### Frontend Testing (React Application)

The React frontend uses Jest and React Testing Library for component testing.

**Run all tests:**
```bash
cd frontend
npm test
```

**Run tests in watch mode:**
```bash
npm test -- --watch
```

**Run tests with coverage:**
```bash
npm test -- --coverage
```

**Test Scripts Available:**
- `npm test`: Run tests in watch mode
- `npm run build`: Build for production
- `npm start`: Start development server

## Infrastructure as Code

This project provides both Terraform and CloudFormation templates for infrastructure deployment:

- **Terraform**: `infrastructure/terraform/` - Declarative infrastructure configuration
- **CloudFormation**: `infrastructure/cloudformation/` - AWS-native template format

Both templates create identical AWS resources including Lambda, API Gateway, S3, KMS, Parameter Store, and CloudWatch resources.

## Troubleshooting

### Common Issues

**Lambda Function Errors:**
- **Missing Environment Variables**: Ensure `NOBL9_CLIENT_ID_PARAM_NAME` and `NOBL9_CLIENT_SECRET_PARAM_NAME` are set
- **Permission Errors**: Verify Lambda execution role has KMS and Parameter Store permissions
- **Build Errors**: Ensure Go 1.21+ is installed and dependencies are downloaded

**Frontend Deployment Issues:**
- **S3 Bucket Not Found**: Verify bucket name and region in deployment script
- **CORS Errors**: Check API Gateway CORS configuration
- **Build Failures**: Ensure Node.js 18+ and all dependencies are installed

**Infrastructure Deployment:**
- **Terraform Errors**: Run `terraform init` and verify AWS credentials
- **CloudFormation Failures**: Check IAM permissions and resource limits
- **KMS Key Issues**: Ensure proper key policy and alias configuration

### Debugging

**Check Lambda Logs:**
```bash
aws logs tail /aws/lambda/nobl9-onboarding-lambda --follow
```

**Test API Endpoint:**
```bash
curl -X GET https://your-api-gateway-url.execute-api.region.amazonaws.com/prod/health
```

**Verify S3 Website:**
```bash
aws s3 ls s3://your-frontend-bucket-name
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Check the [troubleshooting section](#troubleshooting) above
- Review the [deployment documentation](#installation-and-setup)
- Open an issue in the [GitHub repository](https://github.com/your-org/Nobl9-wizard/issues)

## Contributing

We welcome contributions! Please follow these steps:
1. Fork the repository
2. Create a new branch for your feature or bugfix
3. Make your changes and ensure tests pass
4. Submit a pull request with a clear description of your changes

## Code of Conduct

Please be respectful and inclusive in all interactions. We aim to foster a welcoming and collaborative environment for all contributors.

## License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](LICENSE) file for details. 