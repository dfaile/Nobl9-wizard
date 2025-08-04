import { config, api } from './config';

// Mock AWS SDK modules
jest.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: jest.fn(() => Promise.resolve({}))
}));

jest.mock('@aws-sdk/signature-v4', () => ({
  SignatureV4: jest.fn().mockImplementation(() => ({
    sign: jest.fn().mockResolvedValue({
      method: 'POST',
      headers: { 'Authorization': 'AWS4-HMAC-SHA256 ...' },
      body: 'test-body'
    })
  }))
}));

jest.mock('@aws-sdk/protocol-http', () => ({
  HttpRequest: jest.fn().mockImplementation((options) => options)
}));

jest.mock('@aws-crypto/sha256-browser', () => ({
  Sha256: jest.fn()
}));

// Mock fetch
global.fetch = jest.fn();

describe('Config Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration', () => {
    it('should have required configuration properties', () => {
      expect(config).toHaveProperty('apiEndpoint');
      expect(config).toHaveProperty('cognitoIdentityPoolId');
      expect(config).toHaveProperty('awsRegion');
      expect(config).toHaveProperty('helpUrl');
      expect(config).toHaveProperty('maxUsersPerProject');
      expect(config).toHaveProperty('version');
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('features');
    });

    it('should have API endpoints', () => {
      expect(api).toHaveProperty('createProject');
      expect(api).toHaveProperty('healthCheck');
      expect(api).toHaveProperty('call');
      expect(api).toHaveProperty('post');
      expect(api).toHaveProperty('get');
    });

    it('should use environment variables when available', () => {
      const originalEnv = process.env;
      process.env.REACT_APP_API_ENDPOINT = 'https://custom-api.com';
      process.env.REACT_APP_AWS_REGION = 'us-west-2';
      
      // Re-import config to get updated values
      const { config: updatedConfig } = require('./config');
      
      expect(updatedConfig.apiEndpoint).toBe('https://custom-api.com');
      expect(updatedConfig.awsRegion).toBe('us-west-2');
      
      process.env = originalEnv;
    });
  });

  describe('API Security', () => {
    it('should reject non-HTTPS endpoints', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      
      try {
        await api.call('http://insecure-endpoint.com');
        fail('Should have thrown an error for non-HTTPS endpoint');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Only HTTPS endpoints are allowed');
      }
    });

    it('should include security headers in requests', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        headers: new Map([['X-Content-Type-Options', 'nosniff']]),
        ok: true,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      await api.call('https://secure-endpoint.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://secure-endpoint.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Requested-With': 'XMLHttpRequest'
          }),
          signal: expect.any(AbortSignal)
        })
      );
    });

    it('should set request timeout', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        headers: new Map([['X-Content-Type-Options', 'nosniff']]),
        ok: true,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      await api.call('https://secure-endpoint.com');

      const fetchCall = mockFetch.mock.calls[0];
      const options = fetchCall[1] as RequestInit;
      
      expect(options.signal).toBeInstanceOf(AbortSignal);
    });

    it('should warn about missing security headers in response', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      mockFetch.mockResolvedValueOnce({
        headers: new Map(), // No security headers
        ok: true,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      await api.call('https://secure-endpoint.com');

      expect(consoleSpy).toHaveBeenCalledWith('Missing X-Content-Type-Options header in response');
      
      consoleSpy.mockRestore();
    });
  });

  describe('API Helper Methods', () => {
    it('should make POST requests with JSON body', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        headers: new Map([['X-Content-Type-Options', 'nosniff']]),
        ok: true,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      const testData = { test: 'data' };
      await api.post('https://test-api.com', testData);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testData)
        })
      );
    });

    it('should make GET requests', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      mockFetch.mockResolvedValueOnce({
        headers: new Map([['X-Content-Type-Options', 'nosniff']]),
        ok: true,
        status: 200,
        statusText: 'OK'
      } as unknown as Response);

      await api.get('https://test-api.com');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://test-api.com',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      const mockFetch = fetch as jest.MockedFunction<typeof fetch>;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await api.call('https://test-api.com');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(consoleSpy).toHaveBeenCalledWith('Error making signed API request:', error);
      }
      
      consoleSpy.mockRestore();
    });
  });

  describe('Feature Flags', () => {
    it('should handle debug mode configuration', () => {
      expect(config.features).toHaveProperty('enableDebugMode');
      expect(config.features).toHaveProperty('enableAnalytics');
    });

    it('should parse boolean environment variables correctly', () => {
      const originalEnv = process.env;
      process.env.REACT_APP_DEBUG_MODE = 'true';
      process.env.REACT_APP_ANALYTICS = 'false';
      
      // Re-import config to get updated values
      const { config: updatedConfig } = require('./config');
      
      expect(updatedConfig.features.enableDebugMode).toBe(true);
      expect(updatedConfig.features.enableAnalytics).toBe(false);
      
      process.env = originalEnv;
    });
  });

  describe('Validation', () => {
    it('should validate maxUsersPerProject is a number', () => {
      expect(typeof config.maxUsersPerProject).toBe('number');
      expect(config.maxUsersPerProject).toBeGreaterThan(0);
    });

    it('should have valid API endpoint format', () => {
      expect(config.apiEndpoint).toMatch(/^https:\/\//);
    });

    it('should have valid AWS region format', () => {
      expect(config.awsRegion).toMatch(/^[a-z]{2}-[a-z]+-\d+$/);
    });
  });
}); 