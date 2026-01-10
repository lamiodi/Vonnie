import crypto from 'crypto';

/**
 * Generate a random secure password
 * @param {number} length - Length of the password (default: 12)
 * @returns {string} Generated password
 */
export function generateSecurePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(length);
  
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % charset.length;
    password += charset[randomIndex];
  }
  
  // Ensure at least one number, one uppercase, one lowercase, and one special char
  const hasNumber = /[0-9]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*]/.test(password);
  
  if (!hasNumber || !hasUpper || !hasLower || !hasSpecial) {
    return generateSecurePassword(length); // Retry if complexity requirements not met
  }
  
  return password;
}
