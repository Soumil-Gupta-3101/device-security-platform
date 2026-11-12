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
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', authorize('admin'), createDevice);
router.get('/', getAllDevices);
router.get('/:id/risk-breakdown', getRiskBreakdown);
router.get('/:id/alerts', getDeviceAlerts);
router.get('/:id', getDeviceById);
router.put('/:id', authorize('admin', 'analyst'), updateDevice);
router.patch('/:id', authorize('admin', 'analyst'), updateDevice);
router.delete('/:id', authorize('admin'), deleteDevice);

module.exports = router;

