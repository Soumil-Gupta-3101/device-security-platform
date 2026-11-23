const bcrypt = require('bcryptjs');
const User = require('../src/models/User');
const Device = require('../src/models/Device');
const DeviceEvent = require('../src/models/DeviceEvent');
const Alert = require('../src/models/Alert');
const generateToken = require('../src/utils/generateToken');

let counter = 1;

/**
 * Creates and saves a test user in the database.
 * @param {'admin' | 'analyst' | 'viewer'} [role='viewer']
 * @param {object} [overrides={}]
 * @returns {Promise<import('mongoose').Document>}
 */
const createUser = async (role = 'viewer', overrides = {}) => {
  const index = counter++;
  const password = overrides.password || 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  const userData = {
    name: overrides.name || `Test User ${index}`,
    email: overrides.email || `user_${Date.now()}_${index}@test.com`,
    passwordHash,
    role,
    ...overrides
  };

  // If password was passed in overrides, don't save raw password on the model
  delete userData.password;

  return await User.create(userData);
};

/**
 * Returns a signed JWT for the provided user document or object.
 * @param {object} user
 * @returns {string} JWT token
 */
const getToken = (user) => {
  const id = user._id ? user._id.toString() : user.id;
  return generateToken(id, user.role);
};

/**
 * Creates and saves a test device in the database.
 * @param {object} [overrides={}]
 * @returns {Promise<import('mongoose').Document>}
 */
const createDevice = async (overrides = {}) => {
  const index = counter++;
  const deviceData = {
    name: overrides.name || `Device-${index}`,
    ipAddress: overrides.ipAddress || `192.168.1.${index % 250 + 1}`,
    macAddress: overrides.macAddress || `00:1B:44:11:3A:${(index % 90 + 10).toString(16)}`,
    deviceType: overrides.deviceType || 'laptop',
    status: overrides.status || 'unknown',
    riskScore: overrides.riskScore !== undefined ? overrides.riskScore : 0,
    ...overrides
  };

  return await Device.create(deviceData);
};

/**
 * Creates and saves a test device event in the database.
 * @param {string | import('mongoose').Types.ObjectId} deviceId
 * @param {object} [overrides={}]
 * @returns {Promise<import('mongoose').Document>}
 */
const createEvent = async (deviceId, overrides = {}) => {
  const eventData = {
    device: deviceId,
    eventType: overrides.eventType || 'port_scan',
    metadata: overrides.metadata !== undefined ? overrides.metadata : {},
    timestamp: overrides.timestamp || new Date(),
    ...overrides
  };

  return await DeviceEvent.create(eventData);
};

/**
 * Creates and saves a test alert in the database.
 * @param {string | import('mongoose').Types.ObjectId} deviceId
 * @param {object} [overrides={}]
 * @returns {Promise<import('mongoose').Document>}
 */
const createAlert = async (deviceId, overrides = {}) => {
  const alertData = {
    device: deviceId,
    severity: overrides.severity || 'medium',
    reason: overrides.reason || 'Test anomaly detected',
    status: overrides.status || 'open',
    ...overrides
  };

  return await Alert.create(alertData);
};

module.exports = {
  createUser,
  getToken,
  createDevice,
  createEvent,
  createAlert
};
