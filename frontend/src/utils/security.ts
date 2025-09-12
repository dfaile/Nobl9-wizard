/**
 * Security utilities for input sanitization and validation
 */

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param str - The string to sanitize
 * @returns Sanitized string with HTML entities escaped
 */
export function sanitizeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Validates and sanitizes email addresses
 * @param email - The email to validate
 * @returns Sanitized email or null if invalid
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  
  if (emailRegex.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Validates and sanitizes project names
 * @param name - The project name to validate
 * @returns Sanitized name or null if invalid
 */
export function sanitizeProjectName(name: string): string | null {
  const trimmed = name.trim().toLowerCase();
  const nameRegex = /^[a-z0-9-]+$/;
  
  if (nameRegex.test(trimmed) && trimmed.length >= 3 && trimmed.length <= 63) {
    return trimmed;
  }
  return null;
}

/**
 * Sanitizes user IDs (can be emails or usernames)
 * @param userId - The user ID to sanitize
 * @returns Sanitized user ID or null if invalid
 */
export function sanitizeUserId(userId: string): string | null {
  const trimmed = userId.trim();
  
  // If it looks like an email, validate as email
  if (trimmed.includes('@')) {
    return sanitizeEmail(trimmed);
  }
  
  // Otherwise validate as username (alphanumeric, hyphens, underscores)
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (usernameRegex.test(trimmed) && trimmed.length >= 2 && trimmed.length <= 50) {
    return trimmed;
  }
  
  return null;
}

/**
 * Sanitizes description text
 * @param description - The description to sanitize
 * @returns Sanitized description
 */
export function sanitizeDescription(description: string): string {
  // Remove any HTML tags and limit length
  const sanitized = description.replace(/<[^>]*>/g, '').trim();
  return sanitized.substring(0, 500); // Limit to 500 characters
}

/**
 * Generates a cryptographically secure CSRF token
 * @returns A base64-encoded CSRF token
 */
export function generateCsrfToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array)).replace(/[+/]/g, (char) => 
    char === '+' ? '-' : '_'
  ).replace(/=+$/, '');
}

/**
 * Validates CSRF token format and characteristics
 * @param token - The CSRF token to validate
 * @returns True if token has valid format and characteristics
 */
export function validateCsrfToken(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // Check length (base64 encoded 32 bytes should be ~43 chars without padding)
  if (token.length < 32 || token.length > 128) {
    return false;
  }

  // Check for valid base64url characters (RFC 4648 Section 5)
  const base64UrlRegex = /^[A-Za-z0-9_-]+$/;
  if (!base64UrlRegex.test(token)) {
    return false;
  }

  // Check entropy - token should have good character distribution
  const charCounts = new Map<string, number>();
  for (const char of token) {
    charCounts.set(char, (charCounts.get(char) || 0) + 1);
  }

  // If any character appears more than 25% of the time, it's likely not random
  const maxOccurrence = Math.max(...charCounts.values());
  if (maxOccurrence > token.length * 0.25) {
    return false;
  }

  return true;
}

/**
 * Stores CSRF token in sessionStorage with expiration
 * @param token - The CSRF token to store
 * @param expirationMinutes - Minutes until token expires (default: 60)
 */
export function storeCsrfToken(token: string, expirationMinutes: number = 60): void {
  const expiration = Date.now() + (expirationMinutes * 60 * 1000);
  const tokenData = {
    token,
    expiration
  };
  
  try {
    sessionStorage.setItem('csrf_token', JSON.stringify(tokenData));
  } catch (error) {
    console.warn('Failed to store CSRF token:', error);
  }
}

/**
 * Retrieves and validates stored CSRF token
 * @returns The valid CSRF token or null if expired/invalid
 */
export function getCsrfToken(): string | null {
  try {
    const stored = sessionStorage.getItem('csrf_token');
    if (!stored) {
      return null;
    }

    const tokenData = JSON.parse(stored);
    
    // Check if token has expired
    if (Date.now() > tokenData.expiration) {
      sessionStorage.removeItem('csrf_token');
      return null;
    }

    // Validate token format
    if (!validateCsrfToken(tokenData.token)) {
      sessionStorage.removeItem('csrf_token');
      return null;
    }

    return tokenData.token;
  } catch (error) {
    console.warn('Failed to retrieve CSRF token:', error);
    sessionStorage.removeItem('csrf_token');
    return null;
  }
}

/**
 * Gets or generates a CSRF token for the current session
 * @returns A valid CSRF token
 */
export function getOrCreateCsrfToken(): string {
  let token = getCsrfToken();
  
  if (!token) {
    token = generateCsrfToken();
    storeCsrfToken(token);
  }
  
  return token;
} 