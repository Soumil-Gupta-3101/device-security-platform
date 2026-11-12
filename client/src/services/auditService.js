import api from './api'

/**
 * Fetches paginated audit logs from the security backend.
 * @param {Object} [params] - Query parameters (page, limit, action, user)
 * @returns {Promise<{ data: Array, page: number, limit: number, total: number, totalPages: number }>}
 */
export const getAuditLogs = async (params = {}) => {
  const response = await api.get('/audit-logs', { params })
  return response.data
}

export default {
  getAuditLogs,
}

