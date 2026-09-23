const express = require('express');
const {
  createDevice,
  getAllDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
  getRiskBreakdown,
  getDeviceAlerts
} = require('../controllers/deviceController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', createDevice);
router.get('/', getAllDevices);
router.get('/:id/risk-breakdown', getRiskBreakdown);
router.get('/:id/alerts', getDeviceAlerts);
router.get('/:id', getDeviceById);
router.put('/:id', updateDevice);
router.delete('/:id', deleteDevice);

module.exports = router;

