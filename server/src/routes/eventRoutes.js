const express = require('express');
const { ingestEvent, getDeviceEvents } = require('../controllers/eventController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router({ mergeParams: true });

router.post('/', protect, ingestEvent);
router.get('/', protect, getDeviceEvents);

module.exports = router;
