const DeviceEvent = require('../models/DeviceEvent');

/**
 * Severity bands mapping risk score ranges to severity categories.
 * low: 0 - 39
 * medium: 40 - 69
 * high: 70 - 100
 */
const SEVERITY_BANDS = {
  low: [0, 39],
  medium: [40, 69],
  high: [70, 100]
};

const SUSPICIOUS_THRESHOLD = 70;

/**
 * Returns "low", "medium", or "high" based on which band the score falls in.
 *
 * @param {number} score - The numerical risk score.
 * @returns {'low' | 'medium' | 'high'} The severity level label.
 */
const getSeverityLabel = (score) => {
  const numericScore = typeof score === 'number' ? score : Number(score);

  if (numericScore >= SEVERITY_BANDS.high[0] && numericScore <= SEVERITY_BANDS.high[1]) {
    return 'high';
  }
  if (numericScore >= SEVERITY_BANDS.medium[0] && numericScore <= SEVERITY_BANDS.medium[1]) {
    return 'medium';
  }
  if (numericScore >= SEVERITY_BANDS.low[0] && numericScore <= SEVERITY_BANDS.low[1]) {
    return 'low';
  }

  // Clamping fallbacks if score is outside standard 0-100 bounds
  if (numericScore > SEVERITY_BANDS.high[1]) {
    return 'high';
  }
  return 'low';
};

/**
 * Calculates the age-decay weight for an event timestamp.
 * Events up to 1 hour old count 100%, falling linearly to 0% at 24 hours.
 *
 * @param {Date | string | number} timestamp
 * @param {number} [referenceTime=Date.now()]
 * @returns {number} Decayed weight between 0 and 1
 */
const getEventAgeWeight = (timestamp, referenceTime = Date.now()) => {
  if (!timestamp) return 0;
  const eventTime = new Date(timestamp).getTime();
  if (isNaN(eventTime)) return 0;

  const ageMs = Math.max(0, referenceTime - eventTime);
  const oneHourMs = 60 * 60 * 1000;
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;

  if (ageMs <= oneHourMs) {
    return 1.0;
  }
  if (ageMs >= twentyFourHoursMs) {
    return 0.0;
  }

  return (twentyFourHoursMs - ageMs) / (twentyFourHoursMs - oneHourMs);
};

/**
 * Fetches events from the last 24 hours for a given device and calculates
 * the age-decayed risk score.
 *
 * Rules:
 * - "port_scan" eventType present at all → +30 (age-decayed)
 * - 3 or more "failed_auth" eventType events in the set → +20 (age-decayed)
 * - any "firmware_change" eventType present → +10 (age-decayed)
 * - any "location_change" eventType present → +15 (age-decayed)
 * - 2 or more "login_attempt" events with metadata.success === false → +15 (age-decayed)
 *
 * Total score is clamped between 0 and 100.
 *
 * @param {string | import('mongoose').Types.ObjectId} deviceId - ID of the device to score.
 * @returns {Promise<{ score: number, triggeredRules: Array<{ rule: string, points: number, weight: number }> }>}
 */
const calculateRiskScore = async (deviceId) => {
  const now = Date.now();
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

  const events = await DeviceEvent.find({
    device: deviceId,
    timestamp: { $gte: twentyFourHoursAgo }
  });

  const triggeredRules = [];

  // Helper to find the latest event in a subset
  const getLatestEvent = (eventList) => {
    if (!eventList || eventList.length === 0) return null;
    return eventList.reduce((latest, current) => {
      const currentTime = new Date(current.timestamp || current.createdAt).getTime();
      const latestTime = new Date(latest.timestamp || latest.createdAt).getTime();
      return currentTime > latestTime ? current : latest;
    });
  };

  // Rule 1: "port_scan" eventType present at all → +30
  const portScanEvents = events.filter((event) => event.eventType === 'port_scan');
  if (portScanEvents.length > 0) {
    const latest = getLatestEvent(portScanEvents);
    const weight = getEventAgeWeight(latest.timestamp || latest.createdAt, now);
    const points = Math.round(30 * weight);
    if (points > 0) {
      triggeredRules.push({ rule: 'port_scan', points, weight });
    }
  }

  // Rule 2: 3 or more "failed_auth" eventType events in the set → +20
  const failedAuthEvents = events.filter((event) => event.eventType === 'failed_auth');
  if (failedAuthEvents.length >= 3) {
    const latest = getLatestEvent(failedAuthEvents);
    const weight = getEventAgeWeight(latest.timestamp || latest.createdAt, now);
    const points = Math.round(20 * weight);
    if (points > 0) {
      triggeredRules.push({ rule: 'failed_auth', points, weight });
    }
  }

  // Rule 3: any "firmware_change" eventType present → +10
  const firmwareEvents = events.filter((event) => event.eventType === 'firmware_change');
  if (firmwareEvents.length > 0) {
    const latest = getLatestEvent(firmwareEvents);
    const weight = getEventAgeWeight(latest.timestamp || latest.createdAt, now);
    const points = Math.round(10 * weight);
    if (points > 0) {
      triggeredRules.push({ rule: 'firmware_change', points, weight });
    }
  }

  // Rule 4: any "location_change" eventType present → +15
  const locationEvents = events.filter((event) => event.eventType === 'location_change');
  if (locationEvents.length > 0) {
    const latest = getLatestEvent(locationEvents);
    const weight = getEventAgeWeight(latest.timestamp || latest.createdAt, now);
    const points = Math.round(15 * weight);
    if (points > 0) {
      triggeredRules.push({ rule: 'location_change', points, weight });
    }
  }

  // Rule 5: 2 or more "login_attempt" events with metadata.success === false → +15
  const failedLoginEvents = events.filter(
    (event) => event.eventType === 'login_attempt' && event.metadata && event.metadata.success === false
  );
  if (failedLoginEvents.length >= 2) {
    const latest = getLatestEvent(failedLoginEvents);
    const weight = getEventAgeWeight(latest.timestamp || latest.createdAt, now);
    const points = Math.round(15 * weight);
    if (points > 0) {
      triggeredRules.push({ rule: 'failed_login_attempts', points, weight });
    }
  }

  // Sum all triggered rule points, clamped between 0 and 100
  const totalPoints = triggeredRules.reduce((sum, item) => sum + item.points, 0);
  const score = Math.max(0, Math.min(100, totalPoints));

  return {
    score,
    triggeredRules
  };
};

module.exports = {
  calculateRiskScore,
  getEventAgeWeight,
  SEVERITY_BANDS,
  SUSPICIOUS_THRESHOLD,
  getSeverityLabel
};
