const Device = require('../models/Device');
const { calculateRiskScore, SUSPICIOUS_THRESHOLD } = require('./riskEngine');
const { enrichDeviceWithAlerts } = require('./deviceAlertService');
const { getIO, EVENTS } = require('../sockets');

let isRunning = false;

/**
 * Recomputes every device's risk score and derived status using the shared
 * calculateRiskScore function. Updates the database and emits socket updates
 * for any device whose score or status changed.
 */
const recomputeAllDevicesRisk = async () => {
  if (isRunning) {
    console.log('[RiskDecayService] Decay cycle already in progress, skipping iteration.');
    return;
  }

  isRunning = true;
  try {
    const devices = await Device.find({});

    for (const device of devices) {
      try {
        const { score: newScore } = await calculateRiskScore(device._id);
        const updates = {};
        let hasChanges = false;

        if (device.riskScore !== newScore) {
          updates.riskScore = newScore;
          hasChanges = true;
        }

        // Manual statuses ("trusted" and "blocked") are never auto-changed.
        // Derived statuses ("unknown", "normal", "suspicious"):
        // An "unknown" device with no events stays "unknown" until its first event.
        if (device.status !== 'trusted' && device.status !== 'blocked') {
          if (device.status === 'unknown' && !device.firstSeen && !device.lastSeen) {
            // Stays unknown
          } else {
            const derivedStatus = newScore >= SUSPICIOUS_THRESHOLD ? 'suspicious' : 'normal';
            if (device.status !== derivedStatus) {
              updates.status = derivedStatus;
              hasChanges = true;
            }
          }
        }

        if (hasChanges) {
          const updatedDevice = await Device.findByIdAndUpdate(device._id, updates, {
            new: true,
            runValidators: true
          });

          if (updatedDevice) {
            try {
              const enrichedDevice = await enrichDeviceWithAlerts(updatedDevice);
              getIO().emit(EVENTS.DEVICE_UPDATED, enrichedDevice);
            } catch (socketErr) {
              console.error(`[RiskDecayService] Socket emit failed for device ${device._id}:`, socketErr.message);
            }
          }
        }
      } catch (devErr) {
        console.error(`[RiskDecayService] Error processing device ${device._id}:`, devErr);
      }
    }
  } catch (error) {
    console.error('[RiskDecayService] Error during risk decay job execution:', error);
  } finally {
    isRunning = false;
  }
};

/**
 * Starts the risk decay periodic background job.
 * Runs once at startup, then repeats at the configured interval.
 * Does not start when NODE_ENV === 'test'.
 */
const startRiskDecayJob = () => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  const intervalMinutes = parseInt(process.env.RISK_DECAY_INTERVAL_MINUTES, 10) || 5;
  const intervalMs = intervalMinutes * 60 * 1000;

  console.log(`[RiskDecayService] Starting decay job with interval of ${intervalMinutes} minute(s).`);

  // Run once at startup
  recomputeAllDevicesRisk().catch((err) => {
    console.error('[RiskDecayService] Initial startup run failed:', err);
  });

  const timerId = setInterval(() => {
    recomputeAllDevicesRisk().catch((err) => {
      console.error('[RiskDecayService] Scheduled run failed:', err);
    });
  }, intervalMs);

  return timerId;
};

module.exports = {
  recomputeAllDevicesRisk,
  startRiskDecayJob
};
