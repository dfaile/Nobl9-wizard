// Frontend configuration for Nobl9 Wizard
// This file contains configuration settings for the application

export const config = {
  // API Gateway endpoint - will be replaced during deployment
  apiEndpoint: process.env.REACT_APP_API_ENDPOINT || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod',
  
  // Help documentation URL
  helpUrl: process.env.REACT_APP_HELP_URL || 'https://docs.nobl9.com',
  
  // Maximum number of users allowed per project
  maxUsersPerProject: parseInt(process.env.REACT_APP_MAX_USERS_PER_PROJECT || '8'),
  
  // Application version
  version: process.env.REACT_APP_VERSION || '1.0.0',
  
  // Environment (dev, staging, prod)
  environment: process.env.REACT_APP_ENVIRONMENT || 'development',
  
  // Feature flags
  features: {
    enableDebugMode: process.env.REACT_APP_DEBUG_MODE === 'true',
    enableAnalytics: process.env.REACT_APP_ANALYTICS === 'true',
  }
};

// API helper functions
export const api = {
  // Create project endpoint
  createProject: `${config.apiEndpoint}/api/create-project`,
  
  // Health check endpoint
  healthCheck: `${config.apiEndpoint}/health`,
  
  // Helper function to make API calls
  async call(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const defaultOptions: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };
    
    return fetch(endpoint, defaultOptions);
  }
}; 