import {
  sanitizeHtml,
  sanitizeEmail,
  sanitizeProjectName,
  sanitizeUserId,
  sanitizeDescription,
  validateCsrfToken
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

    it('should reject invalid project names', () => {
      const invalidNames = [
        'Project-Name', // uppercase
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

  describe('validateCsrfToken', () => {
    it('should validate tokens with correct length', () => {
      const validToken = 'a'.repeat(32);
      expect(validateCsrfToken(validToken)).toBe(true);
    });

    it('should reject tokens that are too short', () => {
      const shortToken = 'a'.repeat(31);
      expect(validateCsrfToken(shortToken)).toBe(false);
    });

    it('should reject tokens that are too long', () => {
      const longToken = 'a'.repeat(129);
      expect(validateCsrfToken(longToken)).toBe(false);
    });

    it('should reject empty tokens', () => {
      expect(validateCsrfToken('')).toBe(false);
    });
  });
}); 