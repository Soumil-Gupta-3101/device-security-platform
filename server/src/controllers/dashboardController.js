const Device = require('../models/Device');
const Alert = require('../models/Alert');

/**
 * Retrieves overall dashboard summary metrics.
 *
 * @route GET /api/dashboard/summary
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const [
      totalDevices,
      trusted,
      unknown,
      suspicious,
      blocked,
      normal,
      openAlerts,
      low,
      medium,
      high,
      riskResult,
      latestAlert
    ] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ status: 'trusted' }),
      Device.countDocuments({ status: 'unknown' }),
      Device.countDocuments({ status: 'suspicious' }),
      Device.countDocuments({ status: 'blocked' }),
      Device.countDocuments({ status: 'normal' }),
      Alert.countDocuments({ status: { $in: ['open', 'investigating'] } }),
      Alert.countDocuments({ status: 'open', severity: 'low' }),
      Alert.countDocuments({ status: 'open', severity: 'medium' }),
      Alert.countDocuments({ status: 'open', severity: 'high' }),
      Device.aggregate([
        {
          $group: {
            _id: null,
            avgRiskScore: { $avg: '$riskScore' }
          }
        }
      ]),
      Alert.findOne().sort({ createdAt: -1 }).select('createdAt')
    ]);

    const avgRiskScore =
      riskResult.length > 0 && riskResult[0].avgRiskScore !== null
        ? Math.round(riskResult[0].avgRiskScore)
        : 0;

    return res.status(200).json({
      totalDevices,
      devicesByStatus: {
        trusted,
        unknown,
        suspicious,
        blocked,
        normal
      },
      openAlerts,
      openAlertCount: openAlerts,
      lastAlertAt: latestAlert ? latestAlert.createdAt : null,
      alertsBySeverity: {
        low,
        medium,
        high
      },
      avgRiskScore
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardSummary
};
