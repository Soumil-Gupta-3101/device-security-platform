const Alert = require('../models/Alert');

/**
 * Calculates openAlertCount (status: open or investigating)
 * and lastAlertAt (timestamp of most recent alert) for a given device ID.
 *
 * @param {string | import('mongoose').Types.ObjectId} deviceId
 * @returns {Promise<{ openAlertCount: number, lastAlertAt: Date | null }>}
 */
const getDeviceAlertMetrics = async (deviceId) => {
  const [openAlertCount, latestAlert] = await Promise.all([
    Alert.countDocuments({
      device: deviceId,
      status: { $in: ['open', 'investigating'] }
    }),
    Alert.findOne({ device: deviceId }).sort({ createdAt: -1 }).select('createdAt')
  ]);

  return {
    openAlertCount: openAlertCount || 0,
    lastAlertAt: latestAlert ? latestAlert.createdAt : null
  };
};

/**
 * Enriches a single device mongoose document or plain object with alert metrics.
 *
 * @param {object} device
 * @returns {Promise<object>}
 */
const enrichDeviceWithAlerts = async (device) => {
  if (!device) return null;
  const devObj = device.toObject ? device.toObject() : { ...device };
  const metrics = await getDeviceAlertMetrics(devObj._id);
  return {
    ...devObj,
    openAlertCount: metrics.openAlertCount,
    lastAlertAt: metrics.lastAlertAt
  };
};

/**
 * Enriches an array of device mongoose documents with alert metrics in a single aggregation.
 *
 * @param {Array<object>} devices
 * @returns {Promise<Array<object>>}
 */
const enrichDevicesWithAlerts = async (devices) => {
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const deviceIds = devices.map((d) => d._id);

  const alertStats = await Alert.aggregate([
    {
      $match: {
        device: { $in: deviceIds }
      }
    },
    {
      $group: {
        _id: '$device',
        openAlertCount: {
          $sum: {
            $cond: [{ $in: ['$status', ['open', 'investigating']] }, 1, 0]
          }
        },
        lastAlertAt: { $max: '$createdAt' }
      }
    }
  ]);

  const statsMap = new Map();
  alertStats.forEach((stat) => {
    statsMap.set(stat._id.toString(), {
      openAlertCount: stat.openAlertCount || 0,
      lastAlertAt: stat.lastAlertAt || null
    });
  });

  return devices.map((d) => {
    const obj = d.toObject ? d.toObject() : { ...d };
    const stat = statsMap.get(obj._id.toString()) || { openAlertCount: 0, lastAlertAt: null };
    return {
      ...obj,
      openAlertCount: stat.openAlertCount,
      lastAlertAt: stat.lastAlertAt
    };
  });
};

module.exports = {
  getDeviceAlertMetrics,
  enrichDeviceWithAlerts,
  enrichDevicesWithAlerts
};
