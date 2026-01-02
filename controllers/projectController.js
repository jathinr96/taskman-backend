const Project = require('../models/Project');
const User = require('../models/User');

// @desc    Create a new project
// @route   POST /api/projects
// @access  Private
exports.createProject = async (req, res) => {
    try {
        const { name, description, members } = req.body;

        const project = new Project({
            name,
            description,
            owner: req.user.id,
            members: members ? [...members, req.user.id] : [req.user.id] // Ensure owner is a member
        });

        await project.save();

        res.status(201).json(project);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get all projects for current user
// @route   GET /api/projects
// @access  Private
exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find({ members: req.user.id })
            .populate('owner', 'name email profilePicture')
            .sort({ createdAt: -1 });
        res.json(projects);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get project by ID
// @route   GET /api/projects/:id
// @access  Private
exports.getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('owner', 'name email profilePicture')
            .populate('members', 'name email profilePicture');

        if (!project) {
            return res.status(404).json({ msg: 'Project not found' });
        }

        // Check if user is a member
        if (!project.members.some(member => member._id.toString() === req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        res.json(project);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Project not found' });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Add member to project
// @route   POST /api/projects/:id/members
// @access  Private
exports.addMember = async (req, res) => {
    try {
        const { userId } = req.body;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ msg: 'Project not found' });
        }

        // Only owner can add members
        if (project.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Check if already a member
        if (project.members.includes(userId)) {
            return res.status(400).json({ msg: 'User already a member' });
        }

        project.members.push(userId);
        await project.save();

        const updatedProject = await Project.findById(req.params.id)
            .populate('members', 'name email profilePicture')
            .populate('owner', 'name email profilePicture');

        // Emit socket event to notify the added user
        if (req.io) {
            req.io.emit('member:added', {
                userId,
                project: updatedProject
            });
        }

        res.json(updatedProject.members);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Remove member from project
// @route   DELETE /api/projects/:id/members/:userId
// @access  Private
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.params;
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({ msg: 'Project not found' });
        }

        // Only owner can remove members
        if (project.owner.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Cannot remove the owner
        if (userId === project.owner.toString()) {
            return res.status(400).json({ msg: 'Cannot remove the project owner' });
        }

        // Check if user is a member
        if (!project.members.includes(userId)) {
            return res.status(400).json({ msg: 'User is not a member' });
        }

        project.members = project.members.filter(m => m.toString() !== userId);
        await project.save();

        const updatedProject = await Project.findById(req.params.id)
            .populate('members', 'name email profilePicture');

        // Emit socket event to notify the removed user
        if (req.io) {
            req.io.emit('member:removed', {
                userId,
                projectId: req.params.id
            });
        }

        res.json(updatedProject.members);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
