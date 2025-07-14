// Frontend configuration for Nobl9 Wizard
// This file contains configuration settings for the application

import { fromCognitoIdentityPool } from "@aws-sdk/credential-providers";
import { SignatureV4 } from "@aws-sdk/signature-v4";
import { HttpRequest } from "@aws-sdk/protocol-http";
import { Sha256 } from "@aws-crypto/sha256-browser";

export const config = {
  // API Gateway endpoint - will be replaced during deployment
  apiEndpoint: process.env.REACT_APP_API_ENDPOINT || 'https://your-api-gateway-url.execute-api.region.amazonaws.com/prod',
  
  // Cognito Identity Pool ID for IAM authentication
  cognitoIdentityPoolId: process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID || 'your-identity-pool-id',
  
  // AWS Region
  awsRegion: process.env.REACT_APP_AWS_REGION || 'us-east-1',
  
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

// AWS SDK configuration
const credentials = fromCognitoIdentityPool({
  clientConfig: { region: config.awsRegion },
  identityPoolId: config.cognitoIdentityPoolId,
});

const signer = new SignatureV4({
  credentials,
  region: config.awsRegion,
  service: "execute-api",
  sha256: Sha256,
});

// API helper functions with IAM authentication
export const api = {
  // Create project endpoint
  createProject: `${config.apiEndpoint}/api/create-project`,
  
  // Health check endpoint
  healthCheck: `${config.apiEndpoint}/health`,
  
  // Helper function to make signed API calls
  async call(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      // Prepare the HTTP request
      const url = new URL(endpoint);
      const request = new HttpRequest({
        method: options.method || 'GET',
        protocol: url.protocol,
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: options.body,
      });

      // Sign the request
      const signedRequest = await signer.sign(request);

      // Convert signed request to fetch options
      const fetchOptions: RequestInit = {
        method: signedRequest.method,
        headers: signedRequest.headers,
        body: signedRequest.body,
      };

      // Make the request
      return fetch(endpoint, fetchOptions);
    } catch (error) {
      console.error('Error making signed API request:', error);
      throw error;
    }
  },

  // Helper function for POST requests with JSON body
  async post(endpoint: string, data: any): Promise<Response> {
    return this.call(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Helper function for GET requests
  async get(endpoint: string): Promise<Response> {
    return this.call(endpoint, {
      method: 'GET',
    });
  }
}; 