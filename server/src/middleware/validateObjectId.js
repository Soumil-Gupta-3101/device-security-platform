const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Reusable middleware to validate that a route parameter is a 24-character hexadecimal ObjectId.
 * @param {string} [paramName='id'] - The name of the route parameter to validate.
 * @returns {import('express').RequestHandler}
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (!value || typeof value !== 'string' || !OBJECT_ID_REGEX.test(value)) {
      return res.status(400).json({
        error: 'Invalid id',
        message: 'Invalid id'
      });
    }
    next();
  };
};

module.exports = validateObjectId;
module.exports.validateObjectId = validateObjectId;
