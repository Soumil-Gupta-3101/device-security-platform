const AuditLog = require('../models/AuditLog');

/**
 * Creates an AuditLog entry.
 * Wrapped in try/catch so failure only logs to console.error and never throws or breaks the request.
 *
 * @param {string|import('mongoose').Types.ObjectId} userId - Acting user's ID
 * @param {string} action - Action identifier (e.g. "user.login")
 * @param {string} targetType - Type of target entity (e.g. "User", "Device", "Alert")
 * @param {string|import('mongoose').Types.ObjectId} targetId - ID of target entity
 * @param {object} [metadata={}] - Additional details (e.g. old and new status/role)
 * @returns {Promise<import('../models/AuditLog')|null>}
 */
const logAudit = async (userId, action, targetType, targetId, metadata = {}) => {
  try {
    const auditEntry = await AuditLog.create({
      user: userId,
      action,
      targetType,
      targetId,
      metadata
    });
    return auditEntry;
  } catch (error) {
    console.error(`Audit logging failed for action "${action}":`, error.message);
    return null;
  }
};

module.exports = {
  logAudit
};

