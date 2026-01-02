const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, addMember } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes

router.post('/', createProject);
router.get('/', getProjects);
router.get('/:id', getProjectById);
router.post('/:id/members', addMember);

module.exports = router;
