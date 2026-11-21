const express = require('express');
const { ingestEvent, getDeviceEvents } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router({ mergeParams: true });

router.post('/', protect, authorize('admin', 'analyst'), validateObjectId('deviceId'), ingestEvent);
router.get('/', protect, validateObjectId('deviceId'), getDeviceEvents);

module.exports = router;
