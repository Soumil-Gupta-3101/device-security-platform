import api from './api'

/**
 * Fetches all registered platform users (admin only).
 * @returns {Promise<Array>} Array of user objects
 */
export const getUsers = async () => {
  const response = await api.get('/users')
  return response.data
}

/**
 * Updates a user's role (admin only).
 * @param {string} id - Target user ID.
 * @param {string} role - New role ("admin" | "analyst" | "viewer").
 * @returns {Promise<Object>} Updated user object
 */
export const updateUserRole = async (id, role) => {
  const response = await api.patch(`/users/${id}/role`, { role })
  return response.data
}

export default {
  getUsers,
  updateUserRole,
}

