const Device = require('../models/Device');
const Alert = require('../models/Alert');

/**
 * Retrieves overall dashboard summary metrics.
 *
 * @route GET /api/dashboard/summary
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const getDashboardSummary = async (req, res) => {
  try {
    const [
      totalDevices,
      trusted,
      unknown,
      suspicious,
      blocked,
      openAlerts,
      low,
      medium,
      high,
      riskResult
    ] = await Promise.all([
      Device.countDocuments(),
      Device.countDocuments({ status: 'trusted' }),
      Device.countDocuments({ status: 'unknown' }),
      Device.countDocuments({ status: 'suspicious' }),
      Device.countDocuments({ status: 'blocked' }),
      Alert.countDocuments({ status: 'open' }),
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
      ])
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
        blocked
      },
      openAlerts,
      alertsBySeverity: {
        low,
        medium,
        high
      },
      avgRiskScore
    });
  } catch (error) {
    console.error('Error fetching dashboard summary:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Internal server error'
    });
  }
};

module.exports = {
  getDashboardSummary
};
