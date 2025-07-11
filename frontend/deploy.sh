#!/bin/bash

# Nobl9 Wizard Frontend Deployment Script
# This script builds and deploys the React frontend to S3

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="nobl9-wizard"
ENVIRONMENT=${1:-prod}
API_ENDPOINT=${2:-""}

echo -e "${BLUE}🚀 Nobl9 Wizard Frontend Deployment${NC}"
echo -e "${YELLOW}Environment: ${ENVIRONMENT}${NC}"

# Validate environment
if [[ "$ENVIRONMENT" != "dev" && "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "prod" ]]; then
    echo -e "${RED}Error: Environment must be 'dev', 'staging', or 'prod'${NC}"
    exit 1
fi

# Check if API endpoint is provided
if [[ -z "$API_ENDPOINT" ]]; then
    echo -e "${YELLOW}Warning: No API endpoint provided. Using default from config.${NC}"
    echo -e "${YELLOW}To set API endpoint: ./deploy.sh ${ENVIRONMENT} https://your-api-gateway-url.execute-api.region.amazonaws.com/prod${NC}"
fi

# Check prerequisites
echo -e "${BLUE}📋 Checking prerequisites...${NC}"

if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Prerequisites check passed${NC}"

# Get AWS account and region info
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region)
S3_BUCKET="${PROJECT_NAME}-frontend-${AWS_ACCOUNT}-${AWS_REGION}"

echo -e "${BLUE}📍 AWS Account: ${AWS_ACCOUNT}${NC}"
echo -e "${BLUE}📍 AWS Region: ${AWS_REGION}${NC}"
echo -e "${BLUE}📍 S3 Bucket: ${S3_BUCKET}${NC}"

# Check if S3 bucket exists
echo -e "${BLUE}🔍 Checking S3 bucket...${NC}"
if ! aws s3 ls "s3://${S3_BUCKET}" &> /dev/null; then
    echo -e "${YELLOW}Warning: S3 bucket ${S3_BUCKET} does not exist${NC}"
    echo -e "${YELLOW}Please deploy the infrastructure first using Terraform or CloudFormation${NC}"
    exit 1
fi

echo -e "${GREEN}✅ S3 bucket exists${NC}"

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

# Set environment variables for build
echo -e "${BLUE}🔧 Setting build environment...${NC}"

# Create .env file for build
cat > .env << EOF
REACT_APP_ENVIRONMENT=${ENVIRONMENT}
REACT_APP_VERSION=1.0.0
REACT_APP_DEBUG_MODE=false
REACT_APP_ANALYTICS=false
EOF

# Add API endpoint if provided
if [[ -n "$API_ENDPOINT" ]]; then
    echo "REACT_APP_API_ENDPOINT=${API_ENDPOINT}" >> .env
    echo -e "${GREEN}✅ API endpoint set to: ${API_ENDPOINT}${NC}"
else
    echo -e "${YELLOW}⚠️  Using default API endpoint from config${NC}"
fi

# Build the application
echo -e "${BLUE}🔨 Building React application...${NC}"
npm run build

if [[ ! -d "build" ]]; then
    echo -e "${RED}Error: Build failed - build directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completed successfully${NC}"

# Sync to S3
echo -e "${BLUE}📤 Deploying to S3...${NC}"
aws s3 sync build/ "s3://${S3_BUCKET}" --delete

if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✅ Deployment completed successfully${NC}"
else
    echo -e "${RED}Error: S3 sync failed${NC}"
    exit 1
fi

# Get the website URL
WEBSITE_URL=$(aws s3api get-bucket-website --bucket "${S3_BUCKET}" --query WebsiteConfiguration.IndexDocument.Suffix --output text 2>/dev/null || echo "index.html")
WEBSITE_ENDPOINT=$(aws s3api get-bucket-website --bucket "${S3_BUCKET}" --query WebsiteConfiguration.IndexDocument.Suffix --output text 2>/dev/null || echo "index.html")

if [[ "$WEBSITE_URL" == "index.html" ]]; then
    WEBSITE_URL="http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
else
    WEBSITE_URL="http://${S3_BUCKET}.s3-website-${AWS_REGION}.amazonaws.com"
fi

# Invalidate CloudFront cache if distribution exists
echo -e "${BLUE}🔄 Checking for CloudFront distribution...${NC}"
CLOUDFRONT_DISTRIBUTION=$(aws cloudfront list-distributions --query "DistributionList.Items[?contains(Origins.Items[0].DomainName, '${S3_BUCKET}')].Id" --output text 2>/dev/null || echo "")

if [[ -n "$CLOUDFRONT_DISTRIBUTION" ]]; then
    echo -e "${BLUE}🔄 Invalidating CloudFront cache...${NC}"
    aws cloudfront create-invalidation --distribution-id "${CLOUDFRONT_DISTRIBUTION}" --paths "/*"
    echo -e "${GREEN}✅ CloudFront cache invalidation initiated${NC}"
else
    echo -e "${YELLOW}⚠️  No CloudFront distribution found for this bucket${NC}"
fi

# Display deployment summary
echo -e "${GREEN}"
echo "🎉 Deployment Summary"
echo "===================="
echo "Environment: ${ENVIRONMENT}"
echo "S3 Bucket: ${S3_BUCKET}"
echo "Website URL: ${WEBSITE_URL}"
echo "Build Size: $(du -sh build | cut -f1)"
echo "Files Deployed: $(find build -type f | wc -l)"
echo "===================="
echo -e "${NC}"

# Cleanup
echo -e "${BLUE}🧹 Cleaning up...${NC}"
rm -f .env

echo -e "${GREEN}✅ Deployment completed!${NC}"
echo -e "${BLUE}🌐 Your application is available at: ${WEBSITE_URL}${NC}"

# Health check
echo -e "${BLUE}🏥 Performing health check...${NC}"
sleep 5

if curl -s -f "${WEBSITE_URL}" > /dev/null; then
    echo -e "${GREEN}✅ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Health check failed - site may still be propagating${NC}"
fi 