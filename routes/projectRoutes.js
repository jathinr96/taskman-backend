const express = require('express');
const router = express.Router();
const { createProject, getProjects, getProjectById, addMember, removeMember } = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');
const {
    validateBody,
    validateParams,
    createProjectSchema,
    addMemberSchema,
    idParamSchema,
    memberParamSchema
} = require('../middleware/validation');

router.use(protect); // Protect all routes

router.post('/', validateBody(createProjectSchema), createProject);
router.get('/', getProjects);
router.get('/:id', validateParams(idParamSchema), getProjectById);
router.post('/:id/members', validateParams(idParamSchema), validateBody(addMemberSchema), addMember);
router.delete('/:id/members/:userId', validateParams(memberParamSchema), removeMember);

module.exports = router;


