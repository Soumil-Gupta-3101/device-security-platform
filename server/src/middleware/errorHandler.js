/**
 * 404 handler for unknown routes.
 */
const notFound = (req, res, next) => {
  const message = `Cannot ${req.method} ${req.originalUrl}`;
  res.status(404).json({
    error: 'Not Found',
    message
  });
};

/**
 * Centralized error handling middleware.
 * Maps common Mongoose and JWT errors to standard HTTP status codes and API responses.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid id';
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(', ');
  } else if (err.code === 11000) {
    statusCode = 409;
    const keys = Object.keys(err.keyValue || {});
    message = keys.length ? `Duplicate value for field: ${keys.join(', ')}` : 'Duplicate key error';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  const response = {
    error: message,
    message: message
  };

  if (process.env.NODE_ENV !== 'production' && err.stack) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  notFound,
  errorHandler
};

