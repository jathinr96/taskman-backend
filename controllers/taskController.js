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
            // Emit to project room for ProjectDetail page
            req.io.to(`project:${project}`).emit('task:created', populatedTask);
            // Also emit globally for Dashboard stats
            req.io.emit('task:stats:changed', { projectId: project });
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

// @desc    Get all tasks with cursor-based pagination
// @route   GET /api/tasks
// @access  Private
exports.getAllTasks = async (req, res) => {
    try {
        const {
            cursor,
            limit = 20,
            status,
            priority,
            assignee,
            projectId,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        // Get all projects where the user is a member
        const userProjects = await Project.find({ members: req.user.id }).select('_id');
        const projectIds = userProjects.map(p => p._id);

        if (projectIds.length === 0) {
            return res.json({
                tasks: [],
                nextCursor: null,
                hasMore: false,
                total: 0
            });
        }

        // Build query
        let query = { project: { $in: projectIds } };

        // Filter by specific project if provided
        if (projectId) {
            if (!projectIds.some(id => id.toString() === projectId)) {
                return res.status(401).json({ msg: 'Not authorized to view tasks from this project' });
            }
            query.project = projectId;
        }

        // Filter by status
        if (status) {
            query.status = status;
        }

        // Filter by priority
        if (priority) {
            query.priority = priority;
        }

        // Filter by assignee
        if (assignee) {
            query.assignees = assignee;
        }

        // Determine sort field and order
        const validSortFields = ['createdAt', 'dueDate', 'priority', 'title'];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
        const order = sortOrder === 'asc' ? 1 : -1;

        // Cursor-based pagination
        if (cursor) {
            if (order === -1) {
                query._id = { $lt: cursor };
            } else {
                query._id = { $gt: cursor };
            }
        }

        // Get total count for metadata
        const totalCount = await Task.countDocuments({
            project: projectId ? projectId : { $in: projectIds },
            ...(status && { status }),
            ...(priority && { priority }),
            ...(assignee && { assignees: assignee })
        });

        // Fetch tasks with pagination
        const tasks = await Task.find(query)
            .populate('assignees', 'name email profilePicture')
            .populate('project', 'name')
            .populate('comments.user', 'name email profilePicture')
            .sort({ [sortField]: order, _id: order })
            .limit(parseInt(limit) + 1);

        const hasMore = tasks.length > parseInt(limit);
        const resultTasks = hasMore ? tasks.slice(0, -1) : tasks;
        const nextCursor = hasMore && resultTasks.length > 0
            ? resultTasks[resultTasks.length - 1]._id
            : null;

        res.json({
            tasks: resultTasks,
            nextCursor,
            hasMore,
            total: totalCount,
            meta: {
                limit: parseInt(limit),
                sortBy: sortField,
                sortOrder: order === -1 ? 'desc' : 'asc',
                filters: {
                    status: status || null,
                    priority: priority || null,
                    assignee: assignee || null,
                    projectId: projectId || null
                }
            }
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
            // Emit to project room for ProjectDetail page
            req.io.to(`project:${task.project}`).emit('task:updated', populatedTask);
            // Also emit globally for Dashboard stats
            req.io.emit('task:stats:changed', { projectId: task.project.toString() });
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
            // Emit to project room for ProjectDetail page
            req.io.to(`project:${projectId}`).emit('task:deleted', { taskId: req.params.id });
            // Also emit globally for Dashboard stats
            req.io.emit('task:stats:changed', { projectId: projectId.toString() });
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
        const { text, reference } = req.body;
        const task = await Task.findById(req.params.id);

        if (!task) {
            return res.status(404).json({ msg: 'Task not found' });
        }

        task.comments.push({
            user: req.user.id,
            text,
            reference: reference || null
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

// @desc    Specialized text search across task titles, descriptions, and comments
// @route   GET /api/tasks/search/text
// @access  Private
exports.searchTasksText = async (req, res) => {
    try {
        const { q, projectId, limit = 20, includeMatchDetails = 'true' } = req.query;

        if (!q || q.trim().length === 0) {
            return res.status(400).json({ msg: 'Search query required' });
        }

        const searchTerm = q.trim();
        const searchRegex = new RegExp(searchTerm, 'i');
        const resultLimit = Math.min(parseInt(limit) || 20, 50);
        const showMatchDetails = includeMatchDetails === 'true';

        // Build the base query
        let matchQuery = {};

        if (projectId) {
            const mongoose = require('mongoose');
            if (!mongoose.Types.ObjectId.isValid(projectId)) {
                return res.status(400).json({ msg: 'Invalid project ID format' });
            }
            matchQuery.project = new mongoose.Types.ObjectId(projectId);
        }

        // Use aggregation pipeline for more detailed search results
        const pipeline = [
            // Match by project if specified
            ...(Object.keys(matchQuery).length > 0 ? [{ $match: matchQuery }] : []),

            // Add computed fields for matching
            {
                $addFields: {
                    titleMatch: { $regexMatch: { input: '$title', regex: searchRegex } },
                    descriptionMatch: {
                        $cond: [
                            { $ifNull: ['$description', false] },
                            { $regexMatch: { input: '$description', regex: searchRegex } },
                            false
                        ]
                    },
                    matchingComments: {
                        $filter: {
                            input: { $ifNull: ['$comments', []] },
                            as: 'comment',
                            cond: { $regexMatch: { input: '$$comment.text', regex: searchRegex } }
                        }
                    }
                }
            },

            // Add hasCommentMatch field
            {
                $addFields: {
                    hasCommentMatch: { $gt: [{ $size: '$matchingComments' }, 0] }
                }
            },

            // Filter to only include tasks with at least one match
            {
                $match: {
                    $or: [
                        { titleMatch: true },
                        { descriptionMatch: true },
                        { hasCommentMatch: true }
                    ]
                }
            },

            // Add match type array and score
            {
                $addFields: {
                    matchedFields: {
                        $filter: {
                            input: [
                                { $cond: [{ $eq: ['$titleMatch', true] }, 'title', null] },
                                { $cond: [{ $eq: ['$descriptionMatch', true] }, 'description', null] },
                                { $cond: [{ $eq: ['$hasCommentMatch', true] }, 'comments', null] }
                            ],
                            as: 'field',
                            cond: { $ne: ['$$field', null] }
                        }
                    },
                    // Score: title matches = 3, description matches = 2, comment matches = 1
                    relevanceScore: {
                        $add: [
                            { $cond: [{ $eq: ['$titleMatch', true] }, 3, 0] },
                            { $cond: [{ $eq: ['$descriptionMatch', true] }, 2, 0] },
                            { $cond: [{ $eq: ['$hasCommentMatch', true] }, 1, 0] }
                        ]
                    }
                }
            },

            // Sort by relevance score (descending) then by creation date (descending)
            { $sort: { relevanceScore: -1, createdAt: -1 } },

            // Limit results
            { $limit: resultLimit },

            // Lookup to populate project
            {
                $lookup: {
                    from: 'projects',
                    localField: 'project',
                    foreignField: '_id',
                    as: 'projectData',
                    pipeline: [
                        { $project: { name: 1 } }
                    ]
                }
            },

            // Lookup to populate assignees
            {
                $lookup: {
                    from: 'users',
                    localField: 'assignees',
                    foreignField: '_id',
                    as: 'assigneesData',
                    pipeline: [
                        { $project: { name: 1, email: 1, profilePicture: 1 } }
                    ]
                }
            },

            // Lookup to populate comment users
            {
                $lookup: {
                    from: 'users',
                    localField: 'comments.user',
                    foreignField: '_id',
                    as: 'commentUsers',
                    pipeline: [
                        { $project: { name: 1, email: 1, profilePicture: 1 } }
                    ]
                }
            },

            {
                $project: {
                    _id: 1,
                    title: 1,
                    description: 1,
                    status: 1,
                    priority: 1,
                    dueDate: 1,
                    createdAt: 1,
                    project: { $arrayElemAt: ['$projectData', 0] },
                    assignees: '$assigneesData',
                    comments: {
                        $map: {
                            input: '$comments',
                            as: 'comment',
                            in: {
                                _id: '$$comment._id',
                                text: '$$comment.text',
                                createdAt: '$$comment.createdAt',
                                reference: '$$comment.reference',
                                user: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: '$commentUsers',
                                                as: 'u',
                                                cond: { $eq: ['$$u._id', '$$comment.user'] }
                                            }
                                        },
                                        0
                                    ]
                                }
                            }
                        }
                    },
                    matchDetails: {
                        $cond: [
                            showMatchDetails,
                            {
                                matchedFields: '$matchedFields',
                                relevanceScore: '$relevanceScore',
                                matchingCommentCount: { $size: '$matchingComments' },
                                matchingCommentSnippets: {
                                    $map: {
                                        input: { $slice: ['$matchingComments', 3] },
                                        as: 'mc',
                                        in: {
                                            _id: '$$mc._id',
                                            text: { $substrCP: ['$$mc.text', 0, 100] }
                                        }
                                    }
                                }
                            },
                            '$$REMOVE'
                        ]
                    }
                }
            }
        ];

        const results = await Task.aggregate(pipeline);

        // Get total count for the search
        const countPipeline = [
            ...(Object.keys(matchQuery).length > 0 ? [{ $match: matchQuery }] : []),
            {
                $addFields: {
                    titleMatch: { $regexMatch: { input: '$title', regex: searchRegex } },
                    descriptionMatch: {
                        $cond: [
                            { $ifNull: ['$description', false] },
                            { $regexMatch: { input: '$description', regex: searchRegex } },
                            false
                        ]
                    },
                    hasCommentMatch: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: { $ifNull: ['$comments', []] },
                                        as: 'comment',
                                        cond: { $regexMatch: { input: '$$comment.text', regex: searchRegex } }
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $match: {
                    $or: [
                        { titleMatch: true },
                        { descriptionMatch: true },
                        { hasCommentMatch: true }
                    ]
                }
            },
            { $count: 'total' }
        ];

        const countResult = await Task.aggregate(countPipeline);
        const totalCount = countResult.length > 0 ? countResult[0].total : 0;

        res.json({
            query: searchTerm,
            totalResults: totalCount,
            returnedResults: results.length,
            results
        });
    } catch (err) {
        console.error('Text search error:', err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
};
