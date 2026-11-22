const Device = require('../models/Device');
const DeviceEvent = require('../models/DeviceEvent');
const Alert = require('../models/Alert');
const { calculateRiskScore, getSeverityLabel, SUSPICIOUS_THRESHOLD } = require('../services/riskEngine');
const { enrichDeviceWithAlerts } = require('../services/deviceAlertService');
const { getIO, EVENTS } = require('../sockets');

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
const ingestEvent = async (req, res, next) => {
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

    const device = await Device.findById(deviceId);

    if (!device) {
      return res.status(404).json({ error: 'device not found' });
    }

    const event = await DeviceEvent.create({
      device: deviceId,
      eventType,
      metadata
    });

    try {
      getIO().emit(EVENTS.EVENT_CREATED, event);
    } catch (socketError) {
      console.error('Socket emit error (EVENT_CREATED):', socketError);
    }

    const now = new Date();
    const devicePresenceUpdates = { lastSeen: now };
    if (!device.firstSeen) {
      const eventTime = event.timestamp || event.createdAt || now;
      devicePresenceUpdates.firstSeen = eventTime;
      device.firstSeen = eventTime;
    }
    await Device.findByIdAndUpdate(deviceId, devicePresenceUpdates);

    // Recalculate risk score and update device riskScore and status if necessary
    const { score: newScore, triggeredRules } = await calculateRiskScore(deviceId);
    const severity = getSeverityLabel(newScore);

    const deviceUpdates = { riskScore: newScore };
    // Manual statuses ("trusted" and "blocked") are never auto-changed.
    // Derived statuses ("unknown", "normal", "suspicious") are derived from the risk score.
    if (device.status !== 'trusted' && device.status !== 'blocked') {
      const derivedStatus = newScore >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'normal';
      if (device.status !== derivedStatus) {
        deviceUpdates.status = derivedStatus;
        device.status = derivedStatus;
      }
    }
    device.riskScore = newScore;

    const updatedDevice = await Device.findByIdAndUpdate(deviceId, deviceUpdates, { new: true });

    // Alert handling for medium and high severity
    if (severity === 'medium' || severity === 'high') {
      const existingAlert = await Alert.findOne({
        device: deviceId,
        status: { $in: ['open', 'investigating'] }
      });
      const reason = buildReason(triggeredRules);

      if (!existingAlert) {
        const newAlert = await Alert.create({
          device: deviceId,
          severity,
          status: 'open',
          reason
        });

        try {
          await newAlert.populate('device', 'name _id');
          getIO().emit(EVENTS.ALERT_CREATED, newAlert);
        } catch (socketError) {
          console.error('Socket emit error (ALERT_CREATED):', socketError);
        }
      } else {
        const existingSeverityLevel = SEVERITY_LEVELS[existingAlert.severity] || 0;
        const newSeverityLevel = SEVERITY_LEVELS[severity] || 0;

        if (existingSeverityLevel < newSeverityLevel) {
          existingAlert.severity = severity;
        }
        existingAlert.reason = reason;
        await existingAlert.save();

        try {
          await existingAlert.populate('device', 'name _id');
          getIO().emit(EVENTS.ALERT_UPDATED, existingAlert);
        } catch (socketError) {
          console.error('Socket emit error (ALERT_UPDATED):', socketError);
        }
      }
    }

    // Emit DEVICE_UPDATED with fresh openAlertCount, lastAlertAt, and riskScore
    try {
      if (updatedDevice) {
        const enrichedDevice = await enrichDeviceWithAlerts(updatedDevice);
        getIO().emit(EVENTS.DEVICE_UPDATED, enrichedDevice);
      }
    } catch (socketError) {
      console.error('Socket emit error (DEVICE_UPDATED):', socketError);
    }

    return res.status(201).json(event);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieves events for a specified device, sorted by timestamp descending,
 * with an optional limit (default: 50).
 *
 * @route GET /api/devices/:deviceId/events
 */
const getDeviceEvents = async (req, res, next) => {
  try {
    const deviceId = req.params?.deviceId || req.params?.id;
    const parsedLimit = parseInt(req.query?.limit, 10);
    const limit = !isNaN(parsedLimit) && parsedLimit > 0 ? parsedLimit : 50;

    const events = await DeviceEvent.find({ device: deviceId })
      .sort({ timestamp: -1 })
      .limit(limit);

    return res.status(200).json(events);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  ingestEvent,
  getDeviceEvents
};
