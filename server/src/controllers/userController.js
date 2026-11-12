const mongoose = require('mongoose');
const User = require('../models/User');
const { logAudit } = require('../services/auditService');

const VALID_ROLES = ['admin', 'analyst', 'viewer'];

/**
 * Retrieves all users, newest first, excluding passwordHash.
 * @route GET /api/users
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-passwordHash')
      .sort({ createdAt: -1 });

    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

/**
 * Updates a user's role.
 * @route PATCH /api/users/:id/role
 */
const updateUserRole = async (req, res) => {
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

    // Handle malformed id format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        error: 'invalid user id',
        message: 'Invalid user ID format'
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

    let user;
    try {
      user = await User.findById(id);
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(400).json({
          error: 'invalid user id',
          message: 'Invalid user ID format'
        });
      }
      throw err;
    }

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
    console.error('Error updating user role:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

module.exports = {
  getAllUsers,
  updateUserRole
};

