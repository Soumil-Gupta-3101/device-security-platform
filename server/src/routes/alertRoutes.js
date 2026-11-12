const express = require('express');
const {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote
} = require('../controllers/alertController');
const { protect, authorize } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getAllAlerts);
router.get('/:id', getAlertById);
router.patch('/:id/status', authorize('admin', 'analyst'), updateAlertStatus);
router.put('/:id/status', authorize('admin', 'analyst'), updateAlertStatus);
router.post('/:id/notes', authorize('admin', 'analyst'), addAlertNote);

module.exports = router;
