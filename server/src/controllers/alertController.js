const Alert = require('../models/Alert');

const VALID_STATUSES = ['open', 'investigating', 'resolved'];

/**
 * Retrieves all alerts with optional status/severity filtering and pagination.
 * Populates device with name and _id.
 *
 * @route GET /api/alerts
 */
const getAllAlerts = async (req, res) => {
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
    console.error('Error fetching alerts:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

/**
 * Retrieves a single alert by ID.
 * Populates device (name, _id) and notes.author (name, _id).
 *
 * @route GET /api/alerts/:id
 */
const getAlertById = async (req, res) => {
  try {
    const { id } = req.params;

    let alert;
    try {
      alert = await Alert.findById(id)
        .populate('device', 'name _id')
        .populate('notes.author', 'name _id');
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
      }
      throw err;
    }

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
    }

    return res.status(200).json(alert);
  } catch (error) {
    console.error('Error fetching alert by ID:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

/**
 * Updates an alert's status.
 *
 * @route PATCH /api/alerts/:id/status or PUT /api/alerts/:id/status
 */
const updateAlertStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: 'invalid status value',
        message: 'Status must be one of open, investigating, resolved'
      });
    }

    let alert;
    try {
      alert = await Alert.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
      );
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
      }
      throw err;
    }

    if (!alert) {
      return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
    }

    return res.status(200).json(alert);
  } catch (error) {
    console.error('Error updating alert status:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

/**
 * Adds a note to an alert.
 *
 * @route POST /api/alerts/:id/notes
 */
const addAlertNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({
        error: 'text is required',
        message: 'Note text is required and must be a non-empty string'
      });
    }

    let alert;
    try {
      alert = await Alert.findById(id);
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ error: 'Alert not found', message: 'Alert not found' });
      }
      throw err;
    }

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

    return res.status(200).json(alert);
  } catch (error) {
    console.error('Error adding note to alert:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

module.exports = {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote
};
