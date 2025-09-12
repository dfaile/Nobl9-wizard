// Frontend configuration for Nobl9 Wizard
// This file contains configuration settings for the application

import { getOrCreateCsrfToken } from "./utils/security";

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

// Type guard to check if headers is a plain object (not an array, not Headers)
function isPlainHeaderObject(headers: unknown): headers is Record<string, string> {
  return (
    typeof headers === 'object' &&
    headers !== null &&
    !Array.isArray(headers) &&
    !(headers instanceof Headers)
  );
}

// Helper function to normalize headers
function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) {
    return {};
  }

  if (isPlainHeaderObject(headers)) {
    return headers;
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  return {};
}

// API helper functions with CSRF protection
export const api = {
  // Create project endpoint
  createProject: `${config.apiEndpoint}/api/create-project`,
  
  // Health check endpoint
  healthCheck: `${config.apiEndpoint}/health`,
  
  // Helper function to make API calls with CSRF protection
  async call(endpoint: string, options: RequestInit = {}): Promise<Response> {
    try {
      // Validate endpoint URL
      const url = new URL(endpoint);
      if (!url.protocol.startsWith('https')) {
        throw new Error('Only HTTPS endpoints are allowed for security');
      }
      
      // Get CSRF token for state-changing requests
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...normalizeHeaders(options.headers),
      };

      // Add CSRF token for POST, PUT, PATCH, DELETE requests
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes((options.method || 'GET').toUpperCase())) {
        headers['X-CSRF-Token'] = getOrCreateCsrfToken();
      }

      // Prepare fetch options
      const fetchOptions: RequestInit = {
        method: options.method || 'GET',
        headers,
        body: options.body,
        // Add timeout and security options
        signal: AbortSignal.timeout(30000), // 30 second timeout
      };

      // Make the request
      const response = await fetch(endpoint, fetchOptions);
      
      // Check for security-related response headers
      if (!response.headers.get('X-Content-Type-Options')?.includes('nosniff')) {
        console.warn('Missing X-Content-Type-Options header in response');
      }
      
      return response;
    } catch (error) {
      console.error('Error making API request:', error);
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