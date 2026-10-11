const Device = require('../models/Device');
const DeviceEvent = require('../models/DeviceEvent');
const Alert = require('../models/Alert');
const { calculateRiskScore, getSeverityLabel } = require('../services/riskEngine');

const SEVERITY_LEVELS = {
  low: 1,
  medium: 2,
  high: 3
};

const RULE_PHRASES = {
  port_scan: 'Port scan detected',
  failed_auth: '3+ failed auth attempts detected',
  firmware_change: 'Firmware change detected',
  location_change: 'Location change detected',
  failed_login_attempts: '2+ failed login attempts detected'
};

const formatRuleToPhrase = (ruleItem) => {
  const ruleKey = typeof ruleItem === 'string' ? ruleItem : (ruleItem?.rule || '');
  if (RULE_PHRASES[ruleKey]) {
    return RULE_PHRASES[ruleKey];
  }
  if (!ruleKey) {
    return 'Suspicious activity detected';
  }
  return (
    ruleKey
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' detected'
  );
};

const buildReason = (rules) => {
  if (!Array.isArray(rules) || rules.length === 0) {
    return 'Elevated risk detected';
  }
  return rules.map(formatRuleToPhrase).join('; ');
};

/**
 * Ingests a new event for a specified device.
 * Validates that the device exists, creates a DeviceEvent,
 * updates the device's lastSeen timestamp, recalculates the device's risk score,
 * and updates device riskScore/status accordingly.
 *
 * @route POST /api/devices/:deviceId/events
 */
const ingestEvent = async (req, res) => {
  try {
    const deviceId = req.params?.deviceId || req.params?.id;
    const { eventType, metadata } = req.body || {};

    if (!eventType || typeof eventType !== 'string' || !eventType.trim()) {
      return res.status(400).json({ error: 'eventType is required' });
    }

    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
        return res.status(400).json({ error: 'metadata must be an object' });
      }
    }

    let device;
    try {
      device = await Device.findById(deviceId);
    } catch (err) {
      if (err.name === 'CastError') {
        return res.status(404).json({ error: 'device not found' });
      }
      throw err;
    }

    if (!device) {
      return res.status(404).json({ error: 'device not found' });
    }

    const event = await DeviceEvent.create({
      device: deviceId,
      eventType,
      metadata
    });

    await Device.findByIdAndUpdate(deviceId, { lastSeen: new Date() });

    // Recalculate risk score and update device riskScore and status if necessary
    const { score: newScore, triggeredRules } = await calculateRiskScore(deviceId);
    const severity = getSeverityLabel(newScore);

    const deviceUpdates = { riskScore: newScore };
    if (severity === 'high' && device.status !== 'blocked') {
      deviceUpdates.status = 'suspicious';
      device.status = 'suspicious';
    }
    device.riskScore = newScore;

    await Device.findByIdAndUpdate(deviceId, deviceUpdates);

    // Alert handling for medium and high severity
    if (severity === 'medium' || severity === 'high') {
      const existingAlert = await Alert.findOne({
        device: deviceId,
        status: { $in: ['open', 'investigating'] }
      });
      const reason = buildReason(triggeredRules);

      if (!existingAlert) {
        await Alert.create({
          device: deviceId,
          severity,
          status: 'open',
          reason
        });
      } else {
        const existingSeverityLevel = SEVERITY_LEVELS[existingAlert.severity] || 0;
        const newSeverityLevel = SEVERITY_LEVELS[severity] || 0;

        if (existingSeverityLevel < newSeverityLevel) {
          existingAlert.severity = severity;
        }
        existingAlert.reason = reason;
        await existingAlert.save();
      }
    }

    return res.status(201).json(event);
  } catch (error) {
    console.error('Error ingesting event:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

/**
 * Retrieves events for a specified device, sorted by timestamp descending,
 * with an optional limit (default: 50).
 *
 * @route GET /api/devices/:deviceId/events
 */
const getDeviceEvents = async (req, res) => {
  try {
    const deviceId = req.params?.deviceId || req.params?.id;
    const parsedLimit = parseInt(req.query?.limit, 10);
    const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    const events = await DeviceEvent.find({ device: deviceId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json(events);
  } catch (error) {
    console.error('Error fetching device events:', error);
    return res.status(500).json({ error: 'Internal server error', message: 'Internal server error' });
  }
};

module.exports = {
  ingestEvent,
  getDeviceEvents
};
