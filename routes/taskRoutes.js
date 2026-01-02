const express = require('express');
const router = express.Router();
const {
    createTask,
    getTasksByProject,
    getTaskById,
    updateTask,
    deleteTask,
    assignUser,
    unassignUser,
    addComment,
    searchTasks
} = require('../controllers/taskController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect); // Protect all routes

// Search route (must come before /:id to avoid conflict)
router.get('/search', searchTasks);

// Task CRUD
router.post('/', createTask);
router.get('/project/:projectId', getTasksByProject);
router.get('/:id', getTaskById);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);

// Assignment
router.post('/:id/assign', assignUser);
router.delete('/:id/assign/:userId', unassignUser);

// Comments
router.post('/:id/comments', addComment);

module.exports = router;
