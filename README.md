# Nuvacure Backend API

A collaborative task management API built with Node.js, Express, and MongoDB.

## Features

- 🔐 JWT Authentication
- 📁 Project Management with Member Collaboration
- ✅ Task CRUD with Cursor-based Pagination
- 💬 Task Comments with Threading
- 🔍 Full-text Search across Tasks
- ⚡ Real-time Updates via Socket.io
- 🛡️ Input Validation & Error Handling

## Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd backend

# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/nuvacure
JWT_SECRET=your_jwt_secret_key
NODE_ENV=development
```

## Running the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm start
```

Server runs at `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/search?q=` | Search users by name/email |

### Projects

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | Get all user's projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/:id` | Get project by ID |
| PUT | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/members` | Add member |
| DELETE | `/api/projects/:id/members/:userId` | Remove member |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | Get all tasks (paginated) |
| POST | `/api/tasks` | Create a new task |
| GET | `/api/tasks/:id` | Get task by ID |
| PUT | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |
| GET | `/api/tasks/project/:projectId` | Get tasks by project |
| POST | `/api/tasks/:id/assign` | Assign user to task |
| DELETE | `/api/tasks/:id/assign/:userId` | Unassign user |
| POST | `/api/tasks/:id/comments` | Add comment |
| GET | `/api/tasks/search?q=` | Basic text search |
| GET | `/api/tasks/search/text?q=` | Advanced text search |

### Query Parameters

**Pagination (GET /api/tasks)**
- `cursor` - Cursor for pagination
- `limit` - Results per page (1-100, default: 20)
- `status` - Filter: `todo`, `in-progress`, `done`
- `priority` - Filter: `low`, `medium`, `high`
- `sortBy` - Sort: `createdAt`, `dueDate`, `priority`, `title`
- `sortOrder` - Order: `asc`, `desc`

**Text Search (GET /api/tasks/search/text)**
- `q` - Search query (required)
- `projectId` - Filter by project
- `limit` - Max results (1-50)
- `includeMatchDetails` - Include match info (`true`/`false`)

## Testing

Tests use Jest with MongoDB Memory Server (no real database affected).

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/controllers/auth.test.js
```

### Test Structure

```
tests/
├── setup.js                    # Test database setup
├── testApp.js                  # Express app for testing
├── middleware/
│   └── errorHandler.test.js    # Error handler tests
└── controllers/
    ├── auth.test.js            # Auth tests
    ├── project.test.js         # Project tests
    └── task.test.js            # Task tests
```

## Project Structure

```
backend/
├── config/
│   └── db.js                   # Database connection
├── controllers/
│   ├── authController.js       # Auth logic
│   ├── projectController.js    # Project logic
│   └── taskController.js       # Task logic
├── middleware/
│   ├── authMiddleware.js       # JWT verification
│   ├── errorHandler.js         # Global error handler
│   └── validation.js           # Request validation
├── models/
│   ├── User.js                 # User schema
│   ├── Project.js              # Project schema
│   └── Task.js                 # Task schema
├── routes/
│   ├── authRoutes.js           # Auth routes
│   ├── projectRoutes.js        # Project routes
│   └── taskRoutes.js           # Task routes
├── tests/                      # Test files
├── index.js                    # Entry point
├── socket.js                   # Socket.io config
└── package.json
```

## Socket.io Events

### Client → Server
- `join:project` - Join a project room
- `leave:project` - Leave a project room

### Server → Client
- `task:created` - New task created
- `task:updated` - Task updated
- `task:deleted` - Task deleted
- `task:comment` - New comment added
- `member:added` - Member added to project
- `member:removed` - Member removed
- `presence:update` - Online users update

## Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "stack": "..." // Only in development
}
```

## License

ISC
