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
const {
    validateBody,
    validateQuery,
    validateParams,
    createTaskSchema,
    updateTaskSchema,
    assignUserSchema,
    addCommentSchema,
    searchQuerySchema,
    paginationQuerySchema,
    idParamSchema,
    projectIdParamSchema,
    memberParamSchema
} = require('../middleware/validation');

router.use(protect); // Protect all routes

// Search route (must come before /:id to avoid conflict)
router.get('/search', validateQuery(searchQuerySchema), searchTasks);

// Task CRUD
router.post('/', validateBody(createTaskSchema), createTask);
router.get('/project/:projectId', validateParams(projectIdParamSchema), validateQuery(paginationQuerySchema), getTasksByProject);
router.get('/:id', validateParams(idParamSchema), getTaskById);
router.put('/:id', validateParams(idParamSchema), validateBody(updateTaskSchema), updateTask);
router.delete('/:id', validateParams(idParamSchema), deleteTask);

// Assignment
router.post('/:id/assign', validateParams(idParamSchema), validateBody(assignUserSchema), assignUser);
router.delete('/:id/assign/:userId', validateParams(memberParamSchema), unassignUser);

// Comments
router.post('/:id/comments', validateParams(idParamSchema), validateBody(addCommentSchema), addComment);

module.exports = router;

