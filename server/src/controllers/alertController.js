const Alert = require('../models/Alert');
const Device = require('../models/Device');
const { getIO, EVENTS } = require('../sockets');
const { logAudit } = require('../services/auditService');
const { enrichDeviceWithAlerts } = require('../services/deviceAlertService');

const VALID_STATUSES = ['open', 'investigating', 'resolved'];

/**
 * Retrieves all alerts with optional status/severity filtering and pagination.
 * Populates device with name and _id.
 *
 * @route GET /api/alerts
 */
const getAllAlerts = async (req, res, next) => {
  try {
    const { status, severity, page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;

    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (severity) {
      filter.severity = severity;
    }

    const [total, alerts] = await Promise.all([
      Alert.countDocuments(filter),
      Alert.find(filter)
        .populate('device', 'name _id')
        .skip((pageNum - 1) * limitNum)
        .limit(limitNum)
    ]);

    return res.status(200).json({
      data: alerts,
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
 * Retrieves a single alert by ID.
 * Populates device (name, _id) and notes.author (name, _id).
 *
 * @route GET /api/alerts/:id
 */
const getAlertById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const alert = await Alert.findById(id)
      .populate('device', 'name _id')
      .populate('notes.author', 'name _id');

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
    }

    return res.status(200).json(alert);
  } catch (error) {
    next(error);
  }
};

/**
 * Updates an alert's status.
 *
 * @route PATCH /api/alerts/:id/status or PUT /api/alerts/:id/status
 */
const updateAlertStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'invalid status value',
        message: 'Status must be one of open, investigating, resolved'
      });
    }

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
    }

    const oldStatus = alert.status;
    alert.status = status;
    await alert.save();

    const actingUserId = req.user?.id || req.user?._id;
    await logAudit(actingUserId, 'alert.status_changed', 'Alert', alert._id, {
      oldStatus,
      newStatus: status
    });

    try {
      const populatedAlert = await Alert.findById(alert._id)
        .populate('device', 'name _id')
        .populate('notes.author', 'name _id');
      if (populatedAlert) {
        getIO().emit(EVENTS.ALERT_UPDATED, populatedAlert);
      }

      // Emit DEVICE_UPDATED so openAlertCount updates live across the UI
      const affectedDevice = await Device.findById(alert.device);
      if (affectedDevice) {
        const enrichedDevice = await enrichDeviceWithAlerts(affectedDevice);
        getIO().emit(EVENTS.DEVICE_UPDATED, enrichedDevice);
      }
    } catch (socketError) {
      console.error('Socket emit error (ALERT_UPDATED):', socketError);
    }

    return res.status(200).json(alert);
  } catch (error) {
    next(error);
  }
};

/**
 * Adds a note to an alert.
 *
 * @route POST /api/alerts/:id/notes
 */
const addAlertNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'text is required',
        message: 'Note text is required and must be a non-empty string'
      });
    }

    const alert = await Alert.findById(id);

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
    }

    const authorId = req.user?.id || req.user?._id;
    alert.notes.push({
      author: authorId,
      text: text.trim(),
      createdAt: new Date()
    });

    await alert.save();

    await logAudit(authorId, 'alert.note_added', 'Alert', alert._id);

    try {
      const populatedAlert = await Alert.findById(alert._id)
        .populate('device', 'name _id')
        .populate('notes.author', 'name _id');
      if (populatedAlert) {
        getIO().emit(EVENTS.ALERT_UPDATED, populatedAlert);
      }

      // Emit DEVICE_UPDATED so openAlertCount updates live across the UI
      const affectedDevice = await Device.findById(alert.device);
      if (affectedDevice) {
        const enrichedDevice = await enrichDeviceWithAlerts(affectedDevice);
        getIO().emit(EVENTS.DEVICE_UPDATED, enrichedDevice);
      }
    } catch (socketError) {
      console.error('Socket emit error (ALERT_UPDATED):', socketError);
    }

    return res.status(200).json(alert);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote
};
