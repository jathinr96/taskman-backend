// Express app for testing (without starting server)
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('../routes/authRoutes');
const projectRoutes = require('../routes/projectRoutes');
const taskRoutes = require('../routes/taskRoutes');
const { notFound, errorHandler } = require('../middleware/errorHandler');

const createTestApp = () => {
    const app = express();

    // Middleware
    app.use(cors());
    app.use(express.json());

    // Mock io for testing
    app.use((req, res, next) => {
        req.io = {
            to: () => ({ emit: () => { } }),
            emit: () => { }
        };
        next();
    });

    // Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/tasks', taskRoutes);

    // Error Handling
    app.use(notFound);
    app.use(errorHandler);

    return app;
};

module.exports = createTestApp;
