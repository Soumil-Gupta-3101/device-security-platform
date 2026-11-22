const Device = require('../models/Device');
const Alert = require('../models/Alert');
const { calculateRiskScore, SUSPICIOUS_THRESHOLD } = require('../services/riskEngine');
const { logAudit } = require('../services/auditService');
const { enrichDeviceWithAlerts, enrichDevicesWithAlerts } = require('../services/deviceAlertService');
const { getIO, EVENTS } = require('../sockets');

const VALID_STATUSES = ['trusted', 'unknown', 'suspicious', 'blocked', 'normal'];
const VALID_DEVICE_TYPES = ['laptop', 'mobile', 'iot', 'server'];

/**
 * Creates a new device.
 * @route POST /api/devices
 */
const createDevice = async (req, res, next) => {
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
    const actingUserId = req.user?.id || req.user?._id;
    await logAudit(actingUserId, 'device.created', 'Device', device._id);
    return res.status(201).json(device);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves all devices with optional status filtering and pagination.
 * @route GET /api/devices
 */
const getAllDevices = async (req, res, next) => {
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

    const enrichedDevices = await enrichDevicesWithAlerts(devices);

    return res.status(200).json({
      data: enrichedDevices,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum)
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves a single device by ID.
 * @route GET /api/devices/:id
 */
const getDeviceById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const device = await Device.findById(id);

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const enrichedDevice = await enrichDeviceWithAlerts(device);
    return res.status(200).json(enrichedDevice);
  } catch (error) {
    next(error);
  }
};

/**
 * Updates a device by ID.
 * @route PUT /api/devices/:id
 */
const updateDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, deviceType, reason } = req.body || {};

    const existingDevice = await Device.findById(id);
    if (!existingDevice) {
      return res.status(404).json({ error: 'Device not found', message: 'Device not found' });
    }

    const updates = {};

    if (deviceType !== undefined) {
      if (!VALID_DEVICE_TYPES.includes(deviceType)) {
        return res.status(400).json({ error: 'invalid deviceType value', message: 'Invalid deviceType value' });
      }
      updates.deviceType = deviceType;
    }

    let statusChanged = false;
    const oldStatus = existingDevice.status;
    let newStatus = oldStatus;

    if (status !== undefined) {
      // Allowed values for manual status action: "trusted", "blocked", and reset action ("reset")
      if (status === 'reset' || status === 'auto') {
        const { score } = await calculateRiskScore(existingDevice._id);
        // Derived value computed from the current score:
        if (existingDevice.status === 'unknown' && !existingDevice.firstSeen && !existingDevice.lastSeen) {
          newStatus = 'unknown';
        } else {
          newStatus = score >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'normal';
        }
        updates.status = newStatus;
        if (newStatus !== oldStatus) {
          statusChanged = true;
        }
      } else if (['trusted', 'blocked'].includes(status)) {
        newStatus = status;
        updates.status = newStatus;
        if (newStatus !== oldStatus) {
          statusChanged = true;
        }
      } else {
        return res.status(400).json({
          error: 'invalid status value',
          message: 'Allowed status actions are: trusted, blocked, or reset'
        });
      }
    }

    const updatedDevice = await Device.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true
    });

    const actingUserId = req.user?.id || req.user?._id;

    if (statusChanged) {
      const auditMeta = {
        oldStatus,
        newStatus
      };
      if (reason && typeof reason === 'string' && reason.trim()) {
        auditMeta.reason = reason.trim();
      }
      await logAudit(actingUserId, 'device.status_changed', 'Device', updatedDevice._id, auditMeta);
    } else {
      await logAudit(actingUserId, 'device.updated', 'Device', updatedDevice._id);
    }

    const enrichedDevice = await enrichDeviceWithAlerts(updatedDevice);

    try {
      getIO().emit(EVENTS.DEVICE_UPDATED, enrichedDevice);
    } catch (socketError) {
      console.error('Socket emit error (DEVICE_UPDATED):', socketError);
    }

    return res.status(200).json(enrichedDevice);
  } catch (error) {
    next(error);
  }
};

/**
 * Deletes a device by ID.
 * @route DELETE /api/devices/:id
 */
const deleteDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const device = await Device.findByIdAndDelete(id);

    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }

    const actingUserId = req.user?.id || req.user?._id;
    await logAudit(actingUserId, 'device.deleted', 'Device', device._id);

    return res.status(200).json({ message: 'Device deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves the risk score breakdown for a device based on events from the last 24 hours.
 * Read-only, does not persist changes to the database.
 * @route GET /api/devices/:id/risk-breakdown
 */
const getRiskBreakdown = async (req, res, next) => {
  try {
    const { id: deviceId } = req.params;
    const device = await Device.findById(deviceId);

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
    next(error);
  }
};

/**
 * Retrieves all alerts for a specific device, sorted newest-first.
 * @route GET /api/devices/:id/alerts
 */
const getDeviceAlerts = async (req, res, next) => {
  try {
    const { id: deviceId } = req.params;
    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found', message: 'Device not found' });
    }

    const alerts = await Alert.find({ device: deviceId }).sort({ createdAt: -1 });

    return res.status(200).json(alerts);
  } catch (error) {
    next(error);
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
