const express = require('express');
const { ingestEvent, getDeviceEvents } = require('../controllers/eventController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

router.post('/', protect, authorize('admin', 'analyst'), ingestEvent);
router.get('/', protect, getDeviceEvents);

module.exports = router;
