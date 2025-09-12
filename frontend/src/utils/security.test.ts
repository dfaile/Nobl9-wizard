import {
  sanitizeHtml,
  sanitizeEmail,
  sanitizeProjectName,
  sanitizeUserId,
  sanitizeDescription,
  validateCsrfToken,
  generateCsrfToken,
  storeCsrfToken,
  getCsrfToken,
  getOrCreateCsrfToken
} from './security';

describe('Security Utilities', () => {
  describe('sanitizeHtml', () => {
    it('should escape HTML entities to prevent XSS', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = sanitizeHtml(maliciousInput);
      expect(result).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    it('should handle normal text without HTML', () => {
      const normalText = 'Hello World';
      const result = sanitizeHtml(normalText);
      expect(result).toBe('Hello World');
    });

    it('should escape multiple HTML tags', () => {
      const input = '<div><p>Hello</p><img src="x" onerror="alert(1)"></div>';
      const result = sanitizeHtml(input);
      expect(result).toContain('&lt;div&gt;');
      expect(result).toContain('&lt;p&gt;');
      expect(result).toContain('&lt;img');
    });
  });

  describe('sanitizeEmail', () => {
    it('should validate correct email addresses', () => {
      const validEmails = [
        'test@example.com',
        'user.name@domain.co.uk',
        'user+tag@example.org'
      ];

      validEmails.forEach(email => {
        const result = sanitizeEmail(email);
        expect(result).toBe(email.toLowerCase());
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'invalid-email',
        '@example.com',
        'user@',
        'user@.com',
        'user@example',
        'user name@example.com'
      ];

      invalidEmails.forEach(email => {
        const result = sanitizeEmail(email);
        expect(result).toBeNull();
      });
    });

    it('should handle empty and whitespace inputs', () => {
      expect(sanitizeEmail('')).toBeNull();
      expect(sanitizeEmail('   ')).toBeNull();
    });
  });

  describe('sanitizeProjectName', () => {
    it('should validate correct project names', () => {
      const validNames = [
        'my-project',
        'project123',
        'test-project-name',
        'abc'
      ];

      validNames.forEach(name => {
        const result = sanitizeProjectName(name);
        expect(result).toBe(name.toLowerCase());
      });
    });

    it('should accept valid project names after normalization', () => {
      expect(sanitizeProjectName('Project-Name')).toBe('project-name'); // uppercase gets converted
    });

    it('should reject invalid project names', () => {
      const invalidNames = [
        'my_project',   // underscore
        'my project',   // space
        'ab',           // too short
        'a'.repeat(64), // too long
        'project@name', // special chars
        'project-name!', // special chars
        'project-name.', // special chars
        'project-name/', // special chars
        ''              // empty
      ];

      invalidNames.forEach(name => {
        const result = sanitizeProjectName(name);
        expect(result).toBeNull();
      });
    });

    it('should enforce length constraints', () => {
      expect(sanitizeProjectName('ab')).toBeNull(); // too short
      expect(sanitizeProjectName('a'.repeat(64))).toBeNull(); // too long
      expect(sanitizeProjectName('abc')).toBe('abc'); // valid
    });
  });

  describe('sanitizeUserId', () => {
    it('should validate email addresses', () => {
      const validEmails = [
        'user@example.com',
        'test.user@domain.org'
      ];

      validEmails.forEach(email => {
        const result = sanitizeUserId(email);
        expect(result).toBe(email.toLowerCase());
      });
    });

    it('should validate usernames', () => {
      const validUsernames = [
        'username',
        'user123',
        'user-name',
        'user_name',
        'ab'
      ];

      validUsernames.forEach(username => {
        const result = sanitizeUserId(username);
        expect(result).toBe(username);
      });
    });

    it('should reject invalid user IDs', () => {
      const invalidIds = [
        'a',           // too short
        'user@name',   // invalid email
        'user name',   // space
        'user@',       // incomplete email
        'a'.repeat(51) // too long
      ];

      invalidIds.forEach(id => {
        const result = sanitizeUserId(id);
        expect(result).toBeNull();
      });
    });
  });

  describe('sanitizeDescription', () => {
    it('should remove HTML tags', () => {
      const input = '<p>Hello <strong>World</strong></p>';
      const result = sanitizeDescription(input);
      expect(result).toBe('Hello World');
    });

    it('should limit length to 500 characters', () => {
      const longText = 'a'.repeat(600);
      const result = sanitizeDescription(longText);
      expect(result.length).toBe(500);
    });

    it('should handle normal text', () => {
      const text = 'This is a normal description';
      const result = sanitizeDescription(text);
      expect(result).toBe(text);
    });

    it('should trim whitespace', () => {
      const text = '  Hello World  ';
      const result = sanitizeDescription(text);
      expect(result).toBe('Hello World');
    });
  });

  describe('CSRF Token Functions', () => {
    beforeEach(() => {
      // Clear sessionStorage before each test
      sessionStorage.clear();
      
      // Mock crypto.getRandomValues for testing
      Object.defineProperty(global, 'crypto', {
        value: {
          getRandomValues: (arr: Uint8Array) => {
            // Fill with pseudo-random but different values for each call
            for (let i = 0; i < arr.length; i++) {
              arr[i] = (Math.random() * 256) | 0;
            }
            return arr;
          }
        },
        writable: true
      });
    });

    describe('generateCsrfToken', () => {
      it('should generate tokens with proper length', () => {
        const token = generateCsrfToken();
        expect(token.length).toBeGreaterThanOrEqual(32);
        expect(token.length).toBeLessThanOrEqual(64);
      });

      it('should generate different tokens on each call', () => {
        const token1 = generateCsrfToken();
        const token2 = generateCsrfToken();
        expect(token1).not.toBe(token2);
      });

      it('should generate tokens with valid base64url characters', () => {
        const token = generateCsrfToken();
        const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
        expect(base64UrlRegex.test(token)).toBe(true);
      });
    });

    describe('validateCsrfToken', () => {
      it('should validate properly formatted tokens', () => {
        const token = generateCsrfToken();
        expect(validateCsrfToken(token)).toBe(true);
      });

      it('should reject tokens that are too short', () => {
        const shortToken = 'a'.repeat(31);
        expect(validateCsrfToken(shortToken)).toBe(false);
      });

      it('should reject tokens that are too long', () => {
        const longToken = 'a'.repeat(129);
        expect(validateCsrfToken(longToken)).toBe(false);
      });

      it('should reject empty or null tokens', () => {
        expect(validateCsrfToken('')).toBe(false);
        expect(validateCsrfToken(null as any)).toBe(false);
        expect(validateCsrfToken(undefined as any)).toBe(false);
      });

      it('should reject tokens with invalid characters', () => {
        expect(validateCsrfToken('token-with-invalid+chars=')).toBe(false);
        expect(validateCsrfToken('token with spaces')).toBe(false);
        expect(validateCsrfToken('token@with#symbols')).toBe(false);
      });

      it('should reject tokens with poor entropy', () => {
        const poorEntropyToken = 'a'.repeat(40); // All same character
        expect(validateCsrfToken(poorEntropyToken)).toBe(false);
      });
    });

    describe('storeCsrfToken and getCsrfToken', () => {
      it('should store and retrieve tokens successfully', () => {
        const token = generateCsrfToken();
        storeCsrfToken(token, 60);
        
        const retrievedToken = getCsrfToken();
        expect(retrievedToken).toBe(token);
      });

      it('should return null for expired tokens', () => {
        const token = generateCsrfToken();
        storeCsrfToken(token, -1); // Expired token
        
        const retrievedToken = getCsrfToken();
        expect(retrievedToken).toBeNull();
      });

      it('should return null when no token is stored', () => {
        const retrievedToken = getCsrfToken();
        expect(retrievedToken).toBeNull();
      });

      it('should handle corrupted storage gracefully', () => {
        sessionStorage.setItem('csrf_token', 'invalid-json');
        
        const retrievedToken = getCsrfToken();
        expect(retrievedToken).toBeNull();
        
        // Should have cleaned up the corrupted data
        expect(sessionStorage.getItem('csrf_token')).toBeNull();
      });
    });

    describe('getOrCreateCsrfToken', () => {
      it('should return existing valid token', () => {
        const token = generateCsrfToken();
        storeCsrfToken(token, 60);
        
        const retrievedToken = getOrCreateCsrfToken();
        expect(retrievedToken).toBe(token);
      });

      it('should generate new token when none exists', () => {
        const token = getOrCreateCsrfToken();
        expect(token).toBeDefined();
        expect(validateCsrfToken(token)).toBe(true);
      });

      it('should generate new token when existing token is expired', () => {
        const oldToken = generateCsrfToken();
        storeCsrfToken(oldToken, -1); // Expired
        
        const newToken = getOrCreateCsrfToken();
        expect(newToken).not.toBe(oldToken);
        expect(validateCsrfToken(newToken)).toBe(true);
      });
    });
  });
}); 