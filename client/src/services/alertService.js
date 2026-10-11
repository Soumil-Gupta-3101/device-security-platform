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

export const getAllAlerts = getAlerts

/**
 * Fetches alerts for a specific device.
 * @param {string} deviceId - The ID of the device.
 * @returns {Promise<any>} The response data.
 */
export const getDeviceAlerts = async (deviceId) => {
  const response = await api.get(`/devices/${deviceId}/alerts`)
  return response.data
}

/**
 * Fetches a single alert by its ID.
 * @param {string} id - The ID of the alert.
 * @returns {Promise<any>} The response data.
 */
export const getAlertById = async (id) => {
  const response = await api.get(`/alerts/${id}`)
  return response.data
}

/**
 * Updates the status of an alert.
 * @param {string} id - The ID of the alert.
 * @param {string} status - The new status value.
 * @returns {Promise<any>} The response data.
 */
export const updateAlertStatus = async (id, status) => {
  const response = await api.patch(`/alerts/${id}/status`, { status })
  return response.data
}

/**
 * Adds a note to an alert.
 * @param {string} id - The ID of the alert.
 * @param {string} text - The note content.
 * @returns {Promise<any>} The response data.
 */
export const addAlertNote = async (id, text) => {
  const response = await api.post(`/alerts/${id}/notes`, { text })
  return response.data
}

export default {
  getAlerts,
  getAllAlerts,
  getDeviceAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote,
}

