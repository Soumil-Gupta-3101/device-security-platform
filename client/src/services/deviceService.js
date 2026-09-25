import api from './api'

/**
 * Fetches devices with optional filtering and pagination parameters.
 * @param {Object} [params] - Query parameters for pagination/filtering.
 * @returns {Promise<any>} The response data.
 */
export const getDevices = async (params) => {
  const response = await api.get('/devices', { params })
  return response.data
}

/**
 * Fetches a single device by its ID.
 * @param {string} id - The ID of the device to fetch.
 * @returns {Promise<any>} The response data.
 */
export const getDeviceById = async (id) => {
  const response = await api.get(`/devices/${id}`)
  return response.data
}

/**
 * Fetches events for a specific device.
 * @param {string} deviceId - The ID of the device.
 * @param {number} [limit=50] - Maximum number of events to fetch.
 * @returns {Promise<any>} The response data.
 */
export const getDeviceEvents = async (deviceId, limit = 50) => {
  const response = await api.get(`/devices/${deviceId}/events`, {
    params: { limit },
  })
  return response.data
}

/**
 * Fetches the risk score breakdown for a specific device.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<any>} The response data.
 */
export const getRiskBreakdown = async (deviceId) => {
  const response = await api.get(`/devices/${deviceId}/risk-breakdown`)
  return response.data
}

export default {
  getDevices,
  getDeviceById,
  getDeviceEvents,
  getRiskBreakdown,
}

