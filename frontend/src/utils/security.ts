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
 * Validates CSRF token (placeholder for future implementation)
 * @param token - The CSRF token to validate
 * @returns True if token is valid
 */
export function validateCsrfToken(token: string): boolean {
  // TODO: Implement proper CSRF token validation
  // For now, just check if token exists and has reasonable length
  return Boolean(token && token.length >= 32 && token.length <= 128);
} 