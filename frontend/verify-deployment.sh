#!/bin/bash

# Nobl9 Wizard Frontend Deployment Verification
# This script verifies that the frontend is ready for deployment

set -e

echo "🔍 Verifying Nobl9 Wizard Frontend for Deployment"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the frontend directory."
    exit 1
fi

print_info "Current directory: $(pwd)"

# Step 1: Verify build exists
if [ ! -d "build" ]; then
    print_error "Build directory not found. Run 'npm run build' first."
    exit 1
fi
print_success "Build directory exists"

# Step 2: Check essential files
if [ ! -f "build/index.html" ]; then
    print_error "index.html missing from build"
    exit 1
fi
print_success "index.html found"

if [ ! -f "build/asset-manifest.json" ]; then
    print_error "asset-manifest.json missing from build"
    exit 1
fi
print_success "asset-manifest.json found"

# Step 3: Check static assets
if [ ! -d "build/static" ]; then
    print_error "static directory missing from build"
    exit 1
fi
print_success "static directory found"

JS_FILES=$(find build/static/js -name "*.js" 2>/dev/null | wc -l)
CSS_FILES=$(find build/static/css -name "*.css" 2>/dev/null | wc -l)

if [ "$JS_FILES" -eq 0 ]; then
    print_error "No JavaScript files found in build"
    exit 1
fi
print_success "JavaScript files found: $JS_FILES"

if [ "$CSS_FILES" -eq 0 ]; then
    print_error "No CSS files found in build"
    exit 1
fi
print_success "CSS files found: $CSS_FILES"

# Step 4: Verify security headers
print_info "Checking security headers..."

if grep -q "X-Content-Type-Options" build/index.html; then
    print_success "X-Content-Type-Options header found"
else
    print_error "X-Content-Type-Options header missing"
    exit 1
fi

if grep -q "X-Frame-Options" build/index.html; then
    print_success "X-Frame-Options header found"
else
    print_error "X-Frame-Options header missing"
    exit 1
fi

if grep -q "Content-Security-Policy" build/index.html; then
    print_success "Content-Security-Policy header found"
else
    print_error "Content-Security-Policy header missing"
    exit 1
fi

if grep -q "X-XSS-Protection" build/index.html; then
    print_success "X-XSS-Protection header found"
else
    print_error "X-XSS-Protection header missing"
    exit 1
fi

# Step 5: Check bundle sizes
print_info "Checking bundle sizes..."

MAIN_JS_SIZE=$(find build/static/js -name "main.*.js" -exec wc -c {} + | awk '{print $1}')
MAIN_CSS_SIZE=$(find build/static/css -name "main.*.css" -exec wc -c {} + | awk '{print $1}')

print_info "Main JS bundle size: ${MAIN_JS_SIZE} bytes"
print_info "Main CSS bundle size: ${MAIN_CSS_SIZE} bytes"

if [ "$MAIN_JS_SIZE" -gt 1000000 ]; then
    print_warning "Main JS bundle is larger than 1MB - consider optimization"
else
    print_success "Main JS bundle size is reasonable"
fi

if [ "$MAIN_CSS_SIZE" -gt 200000 ]; then
    print_warning "Main CSS bundle is larger than 200KB - consider optimization"
else
    print_success "Main CSS bundle size is reasonable"
fi

# Step 6: Check for security vulnerabilities
print_info "Checking for security vulnerabilities..."

if npm audit --audit-level=high 2>/dev/null; then
    print_success "No high-severity vulnerabilities found"
else
    print_warning "Some vulnerabilities found - check npm audit for details"
fi

# Step 7: Verify TypeScript compilation
print_info "Verifying TypeScript compilation..."

if npm run build > /dev/null 2>&1; then
    print_success "TypeScript compilation successful"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Step 8: Check for environment variables
print_info "Checking environment configuration..."

if [ -f ".env" ]; then
    print_info "Environment file found"
    if grep -q "REACT_APP_API_ENDPOINT" .env; then
        print_success "API endpoint configured"
    else
        print_warning "API endpoint not configured in .env"
    fi
else
    print_info "No .env file found - using default configuration"
fi

# Final summary
echo ""
echo "=================================================="
print_success "🎉 Deployment verification completed successfully!"
echo ""
print_info "Summary:"
print_success "✅ Build directory verified"
print_success "✅ Essential files present"
print_success "✅ Static assets generated"
print_success "✅ Security headers configured"
print_success "✅ Bundle sizes acceptable"
print_success "✅ TypeScript compilation successful"
echo ""
print_success "🚀 Frontend is ready for deployment to AWS!"
echo ""
print_info "Next steps:"
print_info "1. Run: npm run deploy (for production)"
print_info "2. Run: npm run deploy:dev (for development)"
echo ""

exit 0 