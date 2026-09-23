const express = require('express');
const {
  getAllAlerts,
  getAlertById,
  updateAlertStatus,
  addAlertNote
} = require('../controllers/alertController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.get('/', getAllAlerts);
router.get('/:id', getAlertById);
router.patch('/:id/status', updateAlertStatus);
router.post('/:id/notes', addAlertNote);

module.exports = router;
