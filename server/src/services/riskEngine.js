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
 * Fetches events from the last 24 hours for a given device and evaluates risk rules.
 *
 * Rules:
 * - "port_scan" eventType present at all → +30
 * - 3 or more "failed_auth" eventType events in the set → +20
 * - any "firmware_change" eventType present → +10
 * - any "location_change" eventType present → +15
 * - 2 or more "login_attempt" events with metadata.success === false → +15
 *
 * Total score is clamped between 0 and 100.
 *
 * @param {string | import('mongoose').Types.ObjectId} deviceId - ID of the device to score.
 * @returns {Promise<{ score: number, triggeredRules: Array<{ rule: string, points: number }> }>}
 */
const calculateRiskScore = async (deviceId) => {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const events = await DeviceEvent.find({
    device: deviceId,
    timestamp: { $gte: twentyFourHoursAgo }
  });

  const triggeredRules = [];

  // Rule 1: "port_scan" eventType present at all → +30
  const hasPortScan = events.some((event) => event.eventType === 'port_scan');
  if (hasPortScan) {
    triggeredRules.push({ rule: 'port_scan', points: 30 });
  }

  // Rule 2: 3 or more "failed_auth" eventType events in the set → +20
  const failedAuthCount = events.filter((event) => event.eventType === 'failed_auth').length;
  if (failedAuthCount >= 3) {
    triggeredRules.push({ rule: 'failed_auth', points: 20 });
  }

  // Rule 3: any "firmware_change" eventType present → +10
  const hasFirmwareChange = events.some((event) => event.eventType === 'firmware_change');
  if (hasFirmwareChange) {
    triggeredRules.push({ rule: 'firmware_change', points: 10 });
  }

  // Rule 4: any "location_change" eventType present → +15
  const hasLocationChange = events.some((event) => event.eventType === 'location_change');
  if (hasLocationChange) {
    triggeredRules.push({ rule: 'location_change', points: 15 });
  }

  // Rule 5: 2 or more "login_attempt" events with metadata.success === false → +15
  const failedLoginCount = events.filter(
    (event) => event.eventType === 'login_attempt' && event.metadata && event.metadata.success === false
  ).length;
  if (failedLoginCount >= 2) {
    triggeredRules.push({ rule: 'failed_login_attempts', points: 15 });
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
  SEVERITY_BANDS,
  getSeverityLabel
};
