const Device = require('../models/Device');
const Alert = require('../models/Alert');
const { calculateRiskScore } = require('../services/riskEngine');

const VALID_STATUSES = ['trusted', 'unknown', 'suspicious', 'blocked'];
const VALID_DEVICE_TYPES = ['laptop', 'mobile', 'iot', 'server'];

/**
 * Creates a new device.
 * @route POST /api/devices
 */
const createDevice = async (req, res) => {
  try {
    const { name, ipAddress, status, deviceType } = req.body || {};

    if (!name || !ipAddress || (typeof name === 'string' && !name.trim()) || (typeof ipAddress === 'string' && !ipAddress.trim())) {
      return res.status(400).json({ error: 'name and ipAddress are required' });
    }

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'invalid status value' });
    }

    if (deviceType && !VALID_DEVICE_TYPES.includes(deviceType)) {
      return res.status(400).json({ error: 'invalid deviceType value' });
    }

    const device = await Device.create(req.body);
    return res.status(201).json(device);
  } catch (error) {
    console.error('Error creating device:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Retrieves all devices with optional status filtering and pagination.
 * @route GET /api/devices
 */
const getAllDevices = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const [total, devices] = await Promise.all([
      Device.countDocuments(filter),
      Device.find(filter)
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    return res.status(200).json({
      data: devices,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Retrieves a single device by ID.
 * @route GET /api/devices/:id
 */
const getDeviceById = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await Device.findById(id);

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    return res.status(200).json(device);
  } catch (error) {
    console.error('Error fetching device by ID:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Updates a device by ID.
 * @route PUT /api/devices/:id
 */
const updateDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, deviceType } = req.body || {};

    if (status && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'invalid status value' });
    }

    if (deviceType && !VALID_DEVICE_TYPES.includes(deviceType)) {
      return res.status(400).json({ error: 'invalid deviceType value' });
    }

    const device = await Device.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    return res.status(200).json(device);
  } catch (error) {
    console.error('Error updating device:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Deletes a device by ID.
 * @route DELETE /api/devices/:id
 */
const deleteDevice = async (req, res) => {
  try {
    const { id } = req.params;
    const device = await Device.findByIdAndDelete(id);

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    return res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Error deleting device:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Retrieves the risk score breakdown for a device based on events from the last 24 hours.
 * Read-only, does not persist changes to the database.
 * @route GET /api/devices/:id/risk-breakdown
 */
const getRiskBreakdown = async (req, res) => {
  try {
    const { id: deviceId } = req.params;

    let device;
    try {
      device = await Device.findById(deviceId);
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ message: 'Device not found' });
      }
      throw err;
    }

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const { score, triggeredRules } = await calculateRiskScore(deviceId);

    return res.status(200).json({
      deviceId,
      score,
      triggeredRules
    });
  } catch (error) {
    console.error('Error getting risk breakdown:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Retrieves all alerts for a specific device, sorted newest-first.
 * @route GET /api/devices/:id/alerts
 */
const getDeviceAlerts = async (req, res) => {
  try {
    const { id: deviceId } = req.params;

    let device;
    try {
      device = await Device.findById(deviceId);
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ error: 'Device not found', message: 'Device not found' });
      }
      throw err;
    }

    if (!device) {
      return res.status(404).json({ error: 'Device not found', message: 'Device not found' });
    }

    const alerts = await Alert.find({ device: deviceId }).sort({ createdAt: -1 });

    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error fetching device alerts:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

module.exports = {
  createDevice,
  getAllDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  getRiskBreakdown,
  getDeviceAlerts
};

