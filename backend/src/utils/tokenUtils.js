const jwt = require('jsonwebtoken');
const environment = require('../config/environment');

/**
 * Generates a signed JWT token.
 * Payload should contain only non-sensitive claims: { id, email, role }.
 * @param {Object} payload - The data to encode in the token.
 * @returns {string} The signed JWT string.
 */
const generateToken = (payload) => {
  return jwt.sign(payload, environment.jwt.secret, {
    expiresIn: environment.jwt.expiresIn,
    algorithm: 'HS256',
  });
};

/**
 * Verifies and decodes a JWT token.
 * Throws if the token is expired, malformed, or tampered with.
 * @param {string} token - The JWT string to verify.
 * @returns {Object} The decoded payload.
 */
const verifyToken = (token) => {
  return jwt.verify(token, environment.jwt.secret, {
    algorithms: ['HS256'],
  });
};

module.exports = { generateToken, verifyToken };
