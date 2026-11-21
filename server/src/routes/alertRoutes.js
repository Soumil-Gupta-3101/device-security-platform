const express = require('express');
const {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote
} = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

router.use(protect);

router.get('/', getAllAlerts);
router.get('/:id', validateObjectId('id'), getAlertById);
router.patch('/:id/status', authorize('admin', 'analyst'), validateObjectId('id'), updateAlertStatus);
router.put('/:id/status', authorize('admin', 'analyst'), validateObjectId('id'), updateAlertStatus);
router.post('/:id/notes', authorize('admin', 'analyst'), validateObjectId('id'), addAlertNote);

module.exports = router;
