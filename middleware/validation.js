const Joi = require('joi');

// Custom MongoDB ObjectId validation
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

// ========================
// Auth Validation Schemas
// ========================

const registerSchema = Joi.object({
    name: Joi.string().min(2).max(50).required().messages({
        'string.min': 'Name must be at least 2 characters',
        'string.max': 'Name cannot exceed 50 characters',
        'any.required': 'Name is required'
    }),
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email',
        'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
        'string.min': 'Password must be at least 6 characters',
        'any.required': 'Password is required'
    })
});

const loginSchema = Joi.object({
    email: Joi.string().email().required().messages({
        'string.email': 'Please provide a valid email',
        'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
        'any.required': 'Password is required'
    })
});

// ========================
// Project Validation Schemas
// ========================

const createProjectSchema = Joi.object({
    name: Joi.string().min(1).max(100).required().messages({
        'string.min': 'Project name is required',
        'string.max': 'Project name cannot exceed 100 characters',
        'any.required': 'Project name is required'
    }),
    description: Joi.string().max(500).allow('').optional(),
    members: Joi.array().items(objectId).optional()
});

const addMemberSchema = Joi.object({
    userId: objectId.required().messages({
        'any.required': 'User ID is required'
    })
});

// ========================
// Task Validation Schemas
// ========================

const createTaskSchema = Joi.object({
    title: Joi.string().min(1).max(200).required().messages({
        'string.min': 'Task title is required',
        'string.max': 'Task title cannot exceed 200 characters',
        'any.required': 'Task title is required'
    }),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('todo', 'in-progress', 'done').optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    project: objectId.required().messages({
        'any.required': 'Project ID is required'
    }),
    assignees: Joi.array().items(objectId).optional(),
    dueDate: Joi.date().iso().optional().allow(null)
});

const updateTaskSchema = Joi.object({
    title: Joi.string().min(1).max(200).optional(),
    description: Joi.string().max(2000).allow('').optional(),
    status: Joi.string().valid('todo', 'in-progress', 'done').optional(),
    priority: Joi.string().valid('low', 'medium', 'high').optional(),
    dueDate: Joi.date().iso().optional().allow(null)
}).min(1).messages({
    'object.min': 'At least one field must be provided for update'
});

const assignUserSchema = Joi.object({
    userId: objectId.required().messages({
        'any.required': 'User ID is required'
    })
});

const addCommentSchema = Joi.object({
    text: Joi.string().min(1).max(1000).required().messages({
        'string.min': 'Comment text is required',
        'string.max': 'Comment cannot exceed 1000 characters',
        'any.required': 'Comment text is required'
    }),
    reference: objectId.optional().allow(null).messages({
        'string.pattern.base': 'Invalid reference comment ID format'
    })
});

// ========================
// Query Validation Schemas
// ========================

const searchQuerySchema = Joi.object({
    q: Joi.string().min(1).required().messages({
        'string.min': 'Search query is required',
        'any.required': 'Search query is required'
    }),
    projectId: objectId.optional()
});

const userSearchQuerySchema = Joi.object({
    q: Joi.string().min(2).required().messages({
        'string.min': 'Search query must be at least 2 characters',
        'any.required': 'Search query is required'
    })
});

const paginationQuerySchema = Joi.object({
    cursor: objectId.optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    status: Joi.string().valid('todo', 'in-progress', 'done').optional(),
    assignee: objectId.optional()
});

// ========================
// Validation Middleware
// ========================

const validate = (schema, property = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            return res.status(400).json({
                message: 'Validation failed',
                errors
            });
        }

        // Replace with validated and sanitized values
        req[property] = value;
        next();
    };
};

// Convenience middleware functions
const validateBody = (schema) => validate(schema, 'body');
const validateQuery = (schema) => validate(schema, 'query');
const validateParams = (schema) => validate(schema, 'params');

// Param validation schema for MongoDB ObjectId
const idParamSchema = Joi.object({
    id: objectId.required()
});

const projectIdParamSchema = Joi.object({
    projectId: objectId.required()
});

const memberParamSchema = Joi.object({
    id: objectId.required(),
    userId: objectId.required()
});

module.exports = {
    // Schemas
    registerSchema,
    loginSchema,
    createProjectSchema,
    addMemberSchema,
    createTaskSchema,
    updateTaskSchema,
    assignUserSchema,
    addCommentSchema,
    searchQuerySchema,
    userSearchQuerySchema,
    paginationQuerySchema,
    idParamSchema,
    projectIdParamSchema,
    memberParamSchema,
    // Middleware
    validate,
    validateBody,
    validateQuery,
    validateParams
};
