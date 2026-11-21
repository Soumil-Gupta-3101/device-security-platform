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
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

router.use(protect);

router.post('/', authorize('admin'), createDevice);
router.get('/', getAllDevices);
router.get('/:id/risk-breakdown', validateObjectId('id'), getRiskBreakdown);
router.get('/:id/alerts', validateObjectId('id'), getDeviceAlerts);
router.get('/:id', validateObjectId('id'), getDeviceById);
router.put('/:id', authorize('admin', 'analyst'), validateObjectId('id'), updateDevice);
router.patch('/:id', authorize('admin', 'analyst'), validateObjectId('id'), updateDevice);
router.delete('/:id', authorize('admin'), validateObjectId('id'), deleteDevice);

module.exports = router;
