const jwt = require('jsonwebtoken');

/**
 * Middleware to protect routes by validating JWT from the Authorization header.
 */
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'not authorized, no token' });
  }

  const parts = authHeader.split(' ');
  const token = parts[1];

  if (!token || !token.trim()) {
    return res.status(401).json({ error: 'not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'not authorized, invalid token' });
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
      return res.status(403).json({ error: 'forbidden: insufficient role' });
    }
    next();
  };
};

module.exports = {
  protect,
  authorize
};
