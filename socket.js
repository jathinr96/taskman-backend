const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Track online users per project
const onlineUsers = new Map(); // projectId -> Set of { odoc userId, socketId, name }

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Authentication middleware for sockets
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.userName = socket.handshake.auth.userName || 'User';
            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId}`);

        // Join a project room
        socket.on('project:join', (projectId) => {
            socket.join(`project:${projectId}`);
            socket.currentProject = projectId;

            // Track online users
            if (!onlineUsers.has(projectId)) {
                onlineUsers.set(projectId, new Map());
            }
            onlineUsers.get(projectId).set(socket.userId, {
                userId: socket.userId,
                socketId: socket.id,
                name: socket.userName
            });

            // Broadcast updated online users list to project
            const users = Array.from(onlineUsers.get(projectId).values());
            io.to(`project:${projectId}`).emit('presence:update', users);
        });

        // Leave a project room
        socket.on('project:leave', (projectId) => {
            socket.leave(`project:${projectId}`);

            if (onlineUsers.has(projectId)) {
                onlineUsers.get(projectId).delete(socket.userId);
                const users = Array.from(onlineUsers.get(projectId).values());
                io.to(`project:${projectId}`).emit('presence:update', users);
            }
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);

            // Remove from all project rooms
            if (socket.currentProject && onlineUsers.has(socket.currentProject)) {
                onlineUsers.get(socket.currentProject).delete(socket.userId);
                const users = Array.from(onlineUsers.get(socket.currentProject).values());
                io.to(`project:${socket.currentProject}`).emit('presence:update', users);
            }
        });
    });

    return io;
}

module.exports = initSocket;
