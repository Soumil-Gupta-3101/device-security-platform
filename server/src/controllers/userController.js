const mongoose = require('mongoose');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');

const VALID_ROLES = ['admin', 'analyst', 'viewer'];

/**
 * Retrieves all users, newest first, excluding passwordHash.
 * @route GET /api/users
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a user's role.
 * @route PATCH /api/users/:id/role
 */
const updateUserRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};

    // Validate role is one of "admin", "analyst", "viewer"
    if (!role || typeof role !== 'string' || !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: 'invalid role value',
        message: 'Role must be one of admin, analyst, viewer'
      });
    }

    // Block an admin from changing their own role
    const currentUserId = req.user?.id || req.user?._id;
    if (String(currentUserId) === String(id)) {
      return res.status(400).json({
        error: 'cannot change own role',
        message: 'Admins cannot change their own role'
      });
    }

    const user = await User.findById(id);

    // Handle nonexistent user
    if (!user) {
      return res.status(404).json({
        error: 'User not found',
        message: 'User not found'
      });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await logAudit(currentUserId, 'user.role_changed', 'User', user._id, {
      oldRole,
      newRole: role
    });

    const userObj = user.toObject();
    delete userObj.passwordHash;

    return res.status(200).json(userObj);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  updateUserRole
};
