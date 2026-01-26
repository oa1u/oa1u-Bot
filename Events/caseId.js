const crypto = require('crypto');

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * Generate a random string using cryptographically secure random bytes.
 * @param {number} length - Length of the string to generate
 * @param {string} charset - Character set to use (default: alphanumeric)
 * @returns {string} Random string
 */
function makeid(length = 10, charset = CHARSET) {
  if (!length || length < 1) return '';
  const bytes = crypto.randomBytes(length);
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(charset[bytes[i] % charset.length]);
  }
  return result.join('');
}

/**
 * Generate a unique case ID with case type prefix for better identification and collision resistance.
 * Format: CASETYPE-RANDOMSTRING (e.g., WARN-XXXXXXXX, BAN-XXXXXXXX, KICK-XXXXXXXX)
 * @param {string} caseType - Type of case (WARN, BAN, KICK, etc.)
 * @param {number} randomLength - Length of random suffix (default: 8)
 * @returns {string} Unique case ID
 */
function generateCaseId(caseType = 'CASE', randomLength = 8) {
  const typePrefix = (caseType || 'CASE').toUpperCase().slice(0, 10); // Ensure uppercase, max 10 chars
  const randomPart = makeid(randomLength);
  return `${typePrefix}-${randomPart}`;
}

module.exports = {
  makeid, //Simple random string generator
  generateCaseId, //Enhanced case ID generator with type prefix
  CHARSET
};