# Nobl9 Wizard Frontend

A modern React-based frontend for the Nobl9 Wizard application, designed to be hosted on AWS S3 with API Gateway integration.

## 🚀 Features

- **Modern React 18** with TypeScript
- **Responsive Design** - Works on desktop, tablet, and mobile
- **AWS S3 Hosting** - Optimized for static website hosting
- **AWS IAM Authentication** - Secure API access using Cognito Identity Pool
- **API Gateway Integration** - Seamless backend communication with SigV4 signing
- **Accessibility** - WCAG compliant with keyboard navigation
- **Performance Optimized** - Fast loading with code splitting
- **Environment Configuration** - Support for dev, staging, and production

## 📋 Prerequisites

- Node.js 16+ and npm
- AWS CLI configured with appropriate permissions
- S3 bucket with static website hosting enabled
- API Gateway endpoint for backend communication

## 🛠️ Development Setup

### 1. Install Dependencies

```bash
cd frontend
npm install
```

### 2. Environment Configuration

Create a `.env` file in the frontend directory:

```bash
# API Configuration
REACT_APP_API_ENDPOINT=https://your-api-gateway-url.execute-api.region.amazonaws.com/prod

# AWS Configuration
REACT_APP_AWS_REGION=us-east-1
REACT_APP_COGNITO_IDENTITY_POOL_ID=your-identity-pool-id

# Application Settings
REACT_APP_ENVIRONMENT=development
REACT_APP_VERSION=1.0.0
REACT_APP_DEBUG_MODE=true
REACT_APP_ANALYTICS=false

# Help Documentation
REACT_APP_HELP_URL=https://docs.nobl9.com
REACT_APP_MAX_USERS_PER_PROJECT=8
```

### 3. Start Development Server

```bash
npm start
```

The application will be available at `http://localhost:3000`

### 4. Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

## 🚀 Deployment

### Automated Deployment

Use the provided deployment script:

```bash
# Deploy to production (requires Cognito Identity Pool ID and AWS region)
./deploy.sh

# Or with custom parameters
./deploy.sh your-identity-pool-id us-east-1 your-s3-bucket-name
```

### Manual Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Deploy to S3:**
   ```bash
   aws s3 sync build/ s3://your-bucket-name --delete
   ```

3. **Invalidate CloudFront cache (if using CloudFront):**
   ```bash
   aws cloudfront create-invalidation --distribution-id YOUR_DISTRIBUTION_ID --paths "/*"
   ```

## 🏗️ Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── index.html         # Main HTML template
│   ├── manifest.json      # Web app manifest
│   └── favicon.ico        # App icon
├── src/
│   ├── components/        # React components
│   │   ├── ProjectForm.tsx
│   │   └── ProjectForm.css
│   ├── config.ts          # Configuration and API helpers
│   ├── App.tsx           # Main App component
│   ├── App.css           # App styles
│   ├── index.tsx         # Entry point
│   ├── index.css         # Global styles
│   └── reportWebVitals.ts # Performance monitoring
├── package.json           # Dependencies and scripts
├── deploy.sh             # Deployment script
└── README.md             # This file
```

## 🔧 Configuration

### API Integration

The frontend communicates with the backend through the `config.ts` file with automatic AWS IAM authentication:

```typescript
export const config = {
  apiEndpoint: process.env.REACT_APP_API_ENDPOINT || 'default-endpoint',
  awsRegion: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  cognitoIdentityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID || '',
  // ... other config
};

export const api = {
  createProject: `${config.apiEndpoint}/api/create-project`,
  healthCheck: `${config.apiEndpoint}/health`,
  // ... API helper functions with automatic SigV4 signing
};
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REACT_APP_API_ENDPOINT` | API Gateway endpoint | `default-endpoint` |
| `REACT_APP_AWS_REGION` | AWS region for Cognito and API | `us-east-1` |
| `REACT_APP_COGNITO_IDENTITY_POOL_ID` | Cognito Identity Pool ID for IAM auth | `` |
| `REACT_APP_ENVIRONMENT` | Environment name | `development` |
| `REACT_APP_VERSION` | Application version | `1.0.0` |
| `REACT_APP_DEBUG_MODE` | Enable debug features | `false` |
| `REACT_APP_ANALYTICS` | Enable analytics | `false` |
| `REACT_APP_HELP_URL` | Help documentation URL | `https://docs.nobl9.com` |
| `REACT_APP_MAX_USERS_PER_PROJECT` | Max users per project | `8` |

## 🎨 Styling

The application uses modern CSS with:

- **CSS Grid and Flexbox** for responsive layouts
- **CSS Custom Properties** for theming
- **CSS Animations** for smooth interactions
- **Mobile-first** responsive design
- **Accessibility** features (focus states, high contrast)

### Color Scheme

- **Primary**: `#667eea` to `#764ba2` (gradient)
- **Success**: `#27ae60`
- **Error**: `#e74c3c`
- **Warning**: `#f39c12`
- **Text**: `#2c3e50`
- **Background**: Gradient background with glassmorphism effects

## 🔍 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm test -- --watch
```

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🔒 Security

- **AWS IAM Authentication** - All API requests require valid AWS credentials
- **Cognito Identity Pool** - Browser-based IAM credentials for secure access
- **SigV4 Signing** - Automatic request signing for API Gateway
- **CORS Configuration** - Properly configured for API Gateway
- **Content Security Policy** - Configured in index.html
- **HTTPS Only** - Enforced in production
- **Input Validation** - Client-side validation with server-side verification

## 📊 Performance

- **Code Splitting** - Automatic with React.lazy()
- **Bundle Optimization** - Tree shaking and minification
- **Image Optimization** - Optimized static assets
- **Caching Strategy** - Proper cache headers for S3

## 🐛 Troubleshooting

### Common Issues

1. **Build Fails**
   - Check Node.js version (requires 16+)
   - Clear npm cache: `npm cache clean --force`
   - Delete node_modules and reinstall: `rm -rf node_modules && npm install`

2. **API Connection Issues**
   - Verify API Gateway endpoint is correct
   - Check CORS configuration on backend
   - Ensure API Gateway is deployed and accessible
   - Verify Cognito Identity Pool ID is configured correctly
   - Check AWS region configuration matches your deployment

3. **S3 Deployment Issues**
   - Verify AWS credentials are configured
   - Check S3 bucket permissions
   - Ensure bucket has static website hosting enabled

4. **CORS Errors**
   - Verify API Gateway CORS settings
   - Check that the frontend domain is allowed
   - Ensure proper headers are returned

### Debug Mode

Enable debug mode by setting `REACT_APP_DEBUG_MODE=true` in your `.env` file. This will show:

- API endpoint information
- Environment details
- Version information
- Additional logging

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the Mozilla Public License 2.0 - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

For support and questions:

- Check the [Nobl9 Documentation](https://docs.nobl9.com)
- Review the [Infrastructure README](../infrastructure/README.md)
- Open an issue in the repository

## 🔄 Updates

To update the frontend:

1. Pull the latest changes
2. Update dependencies: `npm update`
3. Test locally: `npm start`
4. Build and deploy: `./deploy.sh`

---

**Note**: This frontend is designed to work with the Nobl9 Wizard backend deployed as AWS Lambda functions behind API Gateway. Ensure the backend is properly deployed before testing the frontend. 