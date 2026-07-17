const bcrypt = require('bcrypt');
const environment = require('../config/environment');

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} plainPassword - The plain-text password to hash.
 * @returns {Promise<string>} The bcrypt hash.
 */
const hashPassword = async (plainPassword) => {
  return bcrypt.hash(plainPassword, environment.bcrypt.saltRounds);
};

/**
 * Compares a plain-text password against a bcrypt hash.
 * bcrypt.compare() is inherently constant-time, preventing timing attacks.
 * @param {string} plainPassword - The plain-text password to verify.
 * @param {string} hashedPassword - The stored bcrypt hash.
 * @returns {Promise<boolean>} True if passwords match.
 */
const comparePassword = async (plainPassword, hashedPassword) => {
  return bcrypt.compare(plainPassword, hashedPassword);
};

module.exports = { hashPassword, comparePassword };
