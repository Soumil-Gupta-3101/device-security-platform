const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Middleware to protect routes by validating JWT from the Authorization header
 * and loading the fresh user record from the database.
 */
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'not authorized, no token' });
  }

  const parts = authHeader.split(' ');
  const token = parts[1];

  if (!token || !token.trim()) {
    return res.status(401).json({ error: 'not authorized, no token' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({ error: 'not authorized, invalid token' });
  }

  try {
    const user = await User.findById(decoded.id).select('-passwordHash');

    if (!user) {
      return res.status(401).json({ error: 'not authorized, user not found', message: 'User not found' });
    }

    req.user = user;
    req.user.id = user._id.toString();
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware to authorize access based on user role.
 * @param  {...string} allowedRoles - Permitted roles for the route.
 */
const authorize = (...allowedRoles) => {
  const roles = allowedRoles.flat();
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden: insufficient permissions',
        message: 'Forbidden: insufficient permissions'
      });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
