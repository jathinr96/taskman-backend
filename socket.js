const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

// Track online users per project
const onlineUsers = new Map(); // projectId -> Map of userId -> { userId, socketId, name }

// Track all globally online users
const globalOnlineUsers = new Map(); // userId -> { userId, socketId, name, currentProject }

function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: ['http://localhost:5173', 'http://localhost:3000'],
            methods: ['GET', 'POST'],
            credentials: true
        }
    });

    // Helper to broadcast global presence
    const broadcastGlobalPresence = () => {
        const users = Array.from(globalOnlineUsers.values());
        io.emit('global:presence:update', users);
    };

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

        // Add to global online users
        globalOnlineUsers.set(socket.userId, {
            userId: socket.userId,
            socketId: socket.id,
            name: socket.userName,
            currentProject: null
        });
        broadcastGlobalPresence();

        // Join a project room
        socket.on('project:join', (projectId) => {
            socket.join(`project:${projectId}`);
            socket.currentProject = projectId;

            // Track online users per project
            if (!onlineUsers.has(projectId)) {
                onlineUsers.set(projectId, new Map());
            }
            onlineUsers.get(projectId).set(socket.userId, {
                userId: socket.userId,
                socketId: socket.id,
                name: socket.userName
            });

            // Update global user's current project
            if (globalOnlineUsers.has(socket.userId)) {
                globalOnlineUsers.get(socket.userId).currentProject = projectId;
            }

            // Broadcast updated online users list to project
            const users = Array.from(onlineUsers.get(projectId).values());
            io.to(`project:${projectId}`).emit('presence:update', users);
            broadcastGlobalPresence();
        });

        // Leave a project room
        socket.on('project:leave', (projectId) => {
            socket.leave(`project:${projectId}`);

            if (onlineUsers.has(projectId)) {
                onlineUsers.get(projectId).delete(socket.userId);
                const users = Array.from(onlineUsers.get(projectId).values());
                io.to(`project:${projectId}`).emit('presence:update', users);
            }

            // Update global user's current project
            if (globalOnlineUsers.has(socket.userId)) {
                globalOnlineUsers.get(socket.userId).currentProject = null;
            }
            broadcastGlobalPresence();
        });

        // Handle disconnection
        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.userId}`);

            // Remove from project rooms
            if (socket.currentProject && onlineUsers.has(socket.currentProject)) {
                onlineUsers.get(socket.currentProject).delete(socket.userId);
                const users = Array.from(onlineUsers.get(socket.currentProject).values());
                io.to(`project:${socket.currentProject}`).emit('presence:update', users);
            }

            // Remove from global online users
            globalOnlineUsers.delete(socket.userId);
            broadcastGlobalPresence();
        });

        // Handle being kicked from a project (member removed)
        socket.on('member:kicked', ({ projectId }) => {
            console.log(`User ${socket.userId} kicked from project ${projectId}`);
            socket.leave(`project:${projectId}`);

            if (onlineUsers.has(projectId)) {
                onlineUsers.get(projectId).delete(socket.userId);
                const users = Array.from(onlineUsers.get(projectId).values());
                io.to(`project:${projectId}`).emit('presence:update', users);
            }

            if (socket.currentProject === projectId) {
                socket.currentProject = null;
                if (globalOnlineUsers.has(socket.userId)) {
                    globalOnlineUsers.get(socket.userId).currentProject = null;
                }
            }
            broadcastGlobalPresence();
        });
    });

    return io;
}

module.exports = initSocket;
