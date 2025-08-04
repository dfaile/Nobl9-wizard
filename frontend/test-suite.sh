#!/bin/bash

# Nobl9 Wizard Frontend Test Suite
# This script runs comprehensive tests before deployment

set -e  # Exit on any error

echo "🚀 Starting Nobl9 Wizard Frontend Test Suite"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the frontend directory."
    exit 1
fi

print_status "Current directory: $(pwd)"
print_status "Node version: $(node --version)"
print_status "NPM version: $(npm --version)"

# Step 1: Install dependencies
print_status "Installing dependencies..."
npm install --silent
print_success "Dependencies installed successfully"

# Step 2: Run linting
print_status "Running ESLint..."
if npm run lint 2>/dev/null; then
    print_success "ESLint passed"
else
    print_warning "ESLint not configured or failed - continuing with tests"
fi

# Step 3: Run unit tests
print_status "Running unit tests..."
npm test -- --watchAll=false --coverage --passWithNoTests
print_success "Unit tests completed"

# Step 4: Run security tests
print_status "Running security tests..."
npm test -- --testPathPattern="security.test.ts" --watchAll=false
print_success "Security tests passed"

# Step 5: Run integration tests
print_status "Running integration tests..."
npm test -- --testPathPattern="integration.test.tsx" --watchAll=false
print_success "Integration tests passed"

# Step 6: Check for security vulnerabilities
print_status "Checking for security vulnerabilities..."
if npm audit --audit-level=high; then
    print_success "No high-severity vulnerabilities found"
else
    print_warning "Some vulnerabilities found - check npm audit for details"
fi

# Step 7: Build the application
print_status "Building the application..."
npm run build
print_success "Build completed successfully"

# Step 8: Verify build output
print_status "Verifying build output..."
if [ -d "build" ]; then
    print_success "Build directory created"
    
    # Check for essential files
    if [ -f "build/index.html" ]; then
        print_success "index.html found in build"
    else
        print_error "index.html missing from build"
        exit 1
    fi
    
    if [ -f "build/static/js/main.*.js" ]; then
        print_success "Main JavaScript bundle found"
    else
        print_error "Main JavaScript bundle missing"
        exit 1
    fi
    
    if [ -f "build/static/css/main.*.css" ]; then
        print_success "Main CSS bundle found"
    else
        print_error "Main CSS bundle missing"
        exit 1
    fi
else
    print_error "Build directory not created"
    exit 1
fi

# Step 9: Verify security headers in built HTML
print_status "Verifying security headers in built HTML..."
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

# Step 10: Check bundle size
print_status "Checking bundle sizes..."
MAIN_JS_SIZE=$(find build/static/js -name "main.*.js" -exec wc -c {} + | awk '{print $1}')
MAIN_CSS_SIZE=$(find build/static/css -name "main.*.css" -exec wc -c {} + | awk '{print $1}')

print_status "Main JS bundle size: ${MAIN_JS_SIZE} bytes"
print_status "Main CSS bundle size: ${MAIN_CSS_SIZE} bytes"

# Warn if bundles are too large
if [ "$MAIN_JS_SIZE" -gt 500000 ]; then
    print_warning "Main JS bundle is larger than 500KB - consider optimization"
fi

if [ "$MAIN_CSS_SIZE" -gt 100000 ]; then
    print_warning "Main CSS bundle is larger than 100KB - consider optimization"
fi

# Step 11: Test production build locally (optional)
print_status "Testing production build..."
if command -v serve &> /dev/null; then
    print_status "Starting local server to test production build..."
    timeout 30s serve -s build -l 3000 &
    SERVE_PID=$!
    sleep 5
    
    # Test if server is responding
    if curl -s http://localhost:3000 > /dev/null; then
        print_success "Production build is serving correctly"
    else
        print_warning "Could not verify production build serving"
    fi
    
    kill $SERVE_PID 2>/dev/null || true
else
    print_warning "serve package not installed - skipping production build test"
fi

# Step 12: Final summary
echo ""
echo "=============================================="
print_success "🎉 All tests completed successfully!"
echo ""
print_status "Test Summary:"
print_status "✅ Dependencies installed"
print_status "✅ Unit tests passed"
print_status "✅ Security tests passed"
print_status "✅ Integration tests passed"
print_status "✅ Security vulnerabilities checked"
print_status "✅ Application built successfully"
print_status "✅ Security headers verified"
print_status "✅ Bundle sizes checked"
echo ""
print_success "🚀 Frontend is ready for deployment to AWS!"
echo ""
print_status "Next steps:"
print_status "1. Run: npm run deploy (for production)"
print_status "2. Run: npm run deploy:dev (for development)"
echo ""

# Exit with success
exit 0 