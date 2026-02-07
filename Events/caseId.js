const crypto = require('crypto');

// This function creates unique case IDs for moderation actions, like warnings or bans.
// It uses crypto to make sure the IDs are truly random and secure.
// Generate unique case IDs for moderation actions
// Uses crypto for secure random generation

const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

// Here's how we generate a random string using crypto.
function makeid(length = 10, charset = CHARSET) {
  if (!length || length < 1) return '';
  const bytes = crypto.randomBytes(length);
  const result = [];
  for (let i = 0; i < length; i++) {
    result.push(charset[bytes[i] % charset.length]);
  }
  return result.join('');
}

// This builds a unique case ID, like WARN-XXXXXXXX, for tracking moderation cases.
function generateCaseId(caseType = 'CASE', randomLength = 8) {
  const typePrefix = (caseType || 'CASE').toUpperCase().slice(0, 10);
  const randomPart = makeid(randomLength);
  return `${typePrefix}-${randomPart}`;
}

module.exports = {
  makeid,
  generateCaseId,
  CHARSET
};