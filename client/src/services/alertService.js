import api from './api'

/**
 * Fetches alerts with optional filtering and pagination parameters.
 * @param {Object} [params] - Query parameters for pagination/filtering.
 * @returns {Promise<any>} The response data.
 */
export const getAlerts = async (params) => {
  const response = await api.get('/alerts', { params })
  return response.data
}

/**
 * Fetches alerts for a specific device.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<any>} The response data.
 */
export const getDeviceAlerts = async (deviceId) => {
  const response = await api.get(`/devices/${deviceId}/alerts`)
  return response.data
}

export default {
  getAlerts,
  getDeviceAlerts,
}

