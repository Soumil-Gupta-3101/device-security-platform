const AuditLog = require('../models/AuditLog');

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Retrieves paginated audit logs with optional filtering by action and user.
 * Populates acting user's name and email, sorted newest-first.
 *
 * @route GET /api/audit-logs
 */
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, user } = req.query;

    let pageNum = parseInt(page, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      pageNum = 1;
    }

    let limitNum = parseInt(limit, 10);
    if (isNaN(limitNum) || limitNum < 1) {
      limitNum = 20;
    }
    if (limitNum > 100) {
      limitNum = 100;
    }

    const filter = {};

    if (action && typeof action === 'string' && action.trim()) {
      filter.action = action.trim();
    }

    if (user !== undefined && user !== '') {
      if (!OBJECT_ID_REGEX.test(user)) {
        return res.status(400).json({
          error: 'invalid user id',
          message: 'Invalid user ID format'
        });
      }
      filter.user = user;
    }

    const [total, logs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .populate('user', 'name email')
        .sort({ timestamp: -1 })
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    return res.status(200).json({
      data: logs,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAuditLogs
};
