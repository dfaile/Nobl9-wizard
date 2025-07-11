#!/bin/bash

# Build script for Nobl9 Wizard Lambda function
# This script compiles the Go code for AWS Lambda deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Nobl9 Wizard Lambda function...${NC}"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo -e "${RED}Error: Go is not installed. Please install Go 1.24 or later.${NC}"
    exit 1
fi

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
REQUIRED_VERSION="1.24"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$GO_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo -e "${RED}Error: Go version $GO_VERSION is installed, but version $REQUIRED_VERSION or later is required.${NC}"
    exit 1
fi

echo -e "${GREEN}Go version $GO_VERSION detected${NC}"

# Change to the lambda directory
cd "$(dirname "$0")"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -f bootstrap
rm -f lambda.zip

# Download dependencies
echo -e "${YELLOW}Downloading dependencies...${NC}"
go mod download

# Build for Linux (required for AWS Lambda)
echo -e "${YELLOW}Building for Linux...${NC}"
GOOS=linux GOARCH=amd64 go build -o bootstrap main.go

# Check if build was successful
if [ ! -f bootstrap ]; then
    echo -e "${RED}Error: Build failed. bootstrap file was not created.${NC}"
    exit 1
fi

# Create deployment package
echo -e "${YELLOW}Creating deployment package...${NC}"
zip lambda.zip bootstrap

# Check if zip was created successfully
if [ ! -f lambda.zip ]; then
    echo -e "${RED}Error: Failed to create lambda.zip${NC}"
    exit 1
fi

# Display build information
echo -e "${GREEN}Build completed successfully!${NC}"
echo -e "${YELLOW}Build artifacts:${NC}"
echo -e "  - bootstrap: $(ls -lh bootstrap | awk '{print $5}')"
echo -e "  - lambda.zip: $(ls -lh lambda.zip | awk '{print $5}')"

echo -e "${GREEN}The lambda.zip file is ready for deployment to AWS Lambda.${NC}"
echo -e "${YELLOW}Note: The bootstrap binary is optimized for AWS Lambda runtime.${NC}" 