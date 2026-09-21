const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT for authentication.
 *
 * @param {string|object} userId - The user ID to include in the payload.
 * @param {string} role - The user role to include in the payload.
 * @returns {string} The signed JWT token string.
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN
    }
  );
};

module.exports = generateToken;
module.exports.generateToken = generateToken;
