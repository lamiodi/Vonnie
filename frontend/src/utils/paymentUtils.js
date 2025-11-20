/**
 * Payment utility functions for standardized reference generation
 */

/**
 * Generate a standardized payment reference with consistent format
 * Format: VON-{TYPE}-{TIMESTAMP}-{RANDOM}
 * @param {string} type - Payment type (PAYSTACK, BANK_TRANSFER, POS, etc.)
 * @returns {string} Standardized payment reference
 */
export const generatePaymentReference = (type) => {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substr(2, 9).toUpperCase();
  return `VON-${type}-${timestamp}-${randomString}`;
};

/**
 * Generate a Paystack payment reference
 * @returns {string} Paystack payment reference
 */
export const generatePaystackReference = () => {
  return generatePaymentReference('PAYSTACK');
};

/**
 * Generate a bank transfer payment reference
 * @returns {string} Bank transfer payment reference
 */
export const generateBankTransferReference = () => {
  return generatePaymentReference('BANK');
};

/**
 * Generate a POS payment reference
 * @returns {string} POS payment reference
 */
export const generatePOSReference = () => {
  return generatePaymentReference('POS');
};

/**
 * Validate payment reference format
 * @param {string} reference - Payment reference to validate
 * @returns {boolean} True if reference matches expected format
 */
export const isValidPaymentReference = (reference) => {
  const pattern = /^VON-[A-Z]+-\d+-[A-Z0-9]{9}$/;
  return pattern.test(reference);
};

/**
 * Extract payment type from reference
 * @param {string} reference - Payment reference
 * @returns {string|null} Payment type or null if invalid format
 */
export const getPaymentTypeFromReference = (reference) => {
  if (!isValidPaymentReference(reference)) {
    return null;
  }
  const parts = reference.split('-');
  return parts[1]; // Second part is the type
};