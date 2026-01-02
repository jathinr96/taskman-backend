const Task = require('../models/Task');
const Project = require('../models/Project');

// @desc    Create a new task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res) => {
    try {
        const { title, description, status, priority, project, assignees, dueDate } = req.body;

        // Verify user is a member of the project
        const projectDoc = await Project.findById(project);
        if (!projectDoc) {
            return res.status(404).json({ msg: 'Project not found' });
        }

        if (!projectDoc.members.includes(req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const task = new Task({
            title,
            description,
            status: status || 'todo',
            priority: priority || 'medium',
            project,
            assignees: assignees || [],
            dueDate
        });

        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignees', 'name email profilePicture')
            .populate('project', 'name');

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(`project:${project}`).emit('task:created', populatedTask);
        }

        res.status(201).json(populatedTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get tasks for a project with cursor-based pagination
// @route   GET /api/tasks/project/:projectId
// @access  Private
exports.getTasksByProject = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { cursor, limit = 50, status, assignee } = req.query;

        // Verify user is a member of the project
        const project = await Project.findById(projectId);
        if (!project) {
            return res.status(404).json({ msg: 'Project not found' });
        }

        if (!project.members.includes(req.user.id)) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        // Build query
        let query = { project: projectId };

        if (status) {
            query.status = status;
        }

        if (assignee) {
            query.assignees = assignee;
        }

        // Cursor-based pagination
        if (cursor) {
            query._id = { $lt: cursor };
        }

        const tasks = await Task.find(query)
            .populate('assignees', 'name email profilePicture')
            .populate('comments.user', 'name email profilePicture')
            .sort({ createdAt: -1 })
            .limit(parseInt(limit) + 1);

        const hasMore = tasks.length > parseInt(limit);
        const resultTasks = hasMore ? tasks.slice(0, -1) : tasks;
        const nextCursor = hasMore ? resultTasks[resultTasks.length - 1]._id : null;

        res.json({
            tasks: resultTasks,
            nextCursor,
            hasMore
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTaskById = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id)
            .populate('assignees', 'name email profilePicture')
            .populate('project', 'name members')
            .populate('comments.user', 'name email profilePicture');

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        res.json(task);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Task not found' });
        }
        res.status(500).send('Server Error');
    }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res) => {
    try {
        const { title, description, status, priority, dueDate } = req.body;

        let task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        // Update fields
        if (title) task.title = title;
        if (description !== undefined) task.description = description;
        if (status) task.status = status;
        if (priority) task.priority = priority;
        if (dueDate !== undefined) task.dueDate = dueDate;

        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignees', 'name email profilePicture')
            .populate('comments.user', 'name email profilePicture');

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(`project:${task.project}`).emit('task:updated', populatedTask);
        }

        res.json(populatedTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);
        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        const projectId = task.project;
        await Task.findByIdAndDelete(req.params.id);

        // Emit socket event for real-time update
        if (req.io) {
            req.io.to(`project:${projectId}`).emit('task:deleted', { taskId: req.params.id });
        }

        res.json({ msg: 'Task removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Assign user to task
// @route   POST /api/tasks/:id/assign
// @access  Private
exports.assignUser = async (req, res) => {
    try {
        const { userId } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        if (task.assignees.includes(userId)) {
            return res.status(400).json({ msg: 'User already assigned' });
        }

        task.assignees.push(userId);
        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignees', 'name email profilePicture');

        // Emit socket event
        if (req.io) {
            req.io.to(`project:${task.project}`).emit('task:updated', populatedTask);
        }

        res.json(populatedTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Unassign user from task
// @route   DELETE /api/tasks/:id/assign/:userId
// @access  Private
exports.unassignUser = async (req, res) => {
    try {
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        task.assignees = task.assignees.filter(
            assignee => assignee.toString() !== req.params.userId
        );
        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignees', 'name email profilePicture');

        // Emit socket event
        if (req.io) {
            req.io.to(`project:${task.project}`).emit('task:updated', populatedTask);
        }

        res.json(populatedTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Add comment to task
// @route   POST /api/tasks/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
    try {
        const { text } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        task.comments.push({
            user: req.user.id,
            text
        });

        await task.save();

        const populatedTask = await Task.findById(task._id)
            .populate('assignees', 'name email profilePicture')
            .populate('comments.user', 'name email profilePicture');

        // Emit socket event
        if (req.io) {
            req.io.to(`project:${task.project}`).emit('task:comment', {
                taskId: task._id,
                comment: populatedTask.comments[populatedTask.comments.length - 1]
            });
        }

        res.json(populatedTask);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// @desc    Global search across tasks
// @route   GET /api/tasks/search
// @access  Private
exports.searchTasks = async (req, res) => {
    try {
        const { q, projectId } = req.query;

        if (!q) {
            return res.status(400).json({ msg: 'Search query required' });
        }

        let query = { $text: { $search: q } };

        if (projectId) {
            query.project = projectId;
        }

        const tasks = await Task.find(query, { score: { $meta: 'textScore' } })
            .populate('assignees', 'name email profilePicture')
            .populate('project', 'name')
            .sort({ score: { $meta: 'textScore' } })
            .limit(20);

        res.json(tasks);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};
