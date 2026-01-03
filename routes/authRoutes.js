const express = require('express');
const { registerUser, loginUser, searchUsers } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
    validateBody,
    validateQuery,
    registerSchema,
    loginSchema,
    userSearchQuerySchema
} = require('../middleware/validation');
const router = express.Router();

router.post('/register', validateBody(registerSchema), registerUser);
router.post('/login', validateBody(loginSchema), loginUser);
router.get('/search', protect, validateQuery(userSearchQuerySchema), searchUsers);

module.exports = router;



