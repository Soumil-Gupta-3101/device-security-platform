const express = require('express');
const { getAllUsers, updateUserRole } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/authMiddleware');
const validateObjectId = require('../middleware/validateObjectId');

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/', getAllUsers);
router.patch('/:id/role', validateObjectId('id'), updateUserRole);

module.exports = router;
