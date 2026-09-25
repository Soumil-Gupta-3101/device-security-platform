import api from './api'

/**
 * Fetches dashboard summary metrics.
 * @returns {Promise<any>} The response data.
 */
export const getDashboardSummary = async () => {
  const response = await api.get('/dashboard/summary')
  return response.data
}

export default {
  getDashboardSummary,
}
