const request = require('supertest');
const createTestApp = require('../testApp');

const app = createTestApp();

describe('Task Controller', () => {
    let authToken;
    let userId;
    let projectId;

    beforeEach(async () => {
        // Create and login a user
        const userRes = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Task Test User',
                email: 'task@example.com',
                password: 'password123'
            });
        authToken = userRes.body.token;
        userId = userRes.body._id;

        // Create a project
        const projectRes = await request(app)
            .post('/api/projects')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ name: 'Task Test Project' });
        projectId = projectRes.body._id;
    });

    describe('POST /api/tasks', () => {
        it('should create a new task', async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Task',
                    description: 'A test task description',
                    project: projectId
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('title', 'Test Task');
            expect(res.body).toHaveProperty('status', 'todo');
            expect(res.body).toHaveProperty('priority', 'medium');
        });

        it('should fail without project ID', async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Test Task'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should fail without title', async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    project: projectId
                });

            expect(res.statusCode).toBe(400);
        });

        it('should create task with custom status and priority', async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'High Priority Task',
                    project: projectId,
                    status: 'in-progress',
                    priority: 'high'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('status', 'in-progress');
            expect(res.body).toHaveProperty('priority', 'high');
        });

        it('should create task with due date', async () => {
            const dueDate = new Date('2026-02-01').toISOString();
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    title: 'Task with Due Date',
                    project: projectId,
                    dueDate
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('dueDate');
        });
    });

    describe('GET /api/tasks', () => {
        beforeEach(async () => {
            // Create some tasks
            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Task 1', project: projectId, priority: 'high' });

            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Task 2', project: projectId, status: 'done' });

            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Task 3', project: projectId });
        });

        it('should get all tasks with pagination', async () => {
            const res = await request(app)
                .get('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('tasks');
            expect(res.body).toHaveProperty('hasMore');
            expect(res.body).toHaveProperty('total');
            expect(res.body.tasks.length).toBe(3);
        });

        it('should filter tasks by status', async () => {
            const res = await request(app)
                .get('/api/tasks?status=done')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.tasks.length).toBe(1);
            expect(res.body.tasks[0].status).toBe('done');
        });

        it('should filter tasks by priority', async () => {
            const res = await request(app)
                .get('/api/tasks?priority=high')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.tasks.length).toBe(1);
            expect(res.body.tasks[0].priority).toBe('high');
        });

        it('should limit results', async () => {
            const res = await request(app)
                .get('/api/tasks?limit=2')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.tasks.length).toBe(2);
            expect(res.body.hasMore).toBe(true);
        });

        it('should support cursor-based pagination', async () => {
            const firstPage = await request(app)
                .get('/api/tasks?limit=2')
                .set('Authorization', `Bearer ${authToken}`);

            expect(firstPage.body.nextCursor).toBeDefined();

            const secondPage = await request(app)
                .get(`/api/tasks?limit=2&cursor=${firstPage.body.nextCursor}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(secondPage.statusCode).toBe(200);
            expect(secondPage.body.tasks.length).toBe(1);
        });
    });

    describe('GET /api/tasks/project/:projectId', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Project Task 1', project: projectId });

            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Project Task 2', project: projectId });
        });

        it('should get tasks by project ID', async () => {
            const res = await request(app)
                .get(`/api/tasks/project/${projectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.tasks.length).toBe(2);
        });

        it('should return 404 for non-existent project', async () => {
            const res = await request(app)
                .get('/api/tasks/project/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('GET /api/tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Get Task', project: projectId });
            taskId = res.body._id;
        });

        it('should get task by ID', async () => {
            const res = await request(app)
                .get(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('title', 'Get Task');
        });

        it('should return 404 for non-existent task', async () => {
            const res = await request(app)
                .get('/api/tasks/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('PUT /api/tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Update Task', project: projectId });
            taskId = res.body._id;
        });

        it('should update task title', async () => {
            const res = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Updated Title' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('title', 'Updated Title');
        });

        it('should update task status', async () => {
            const res = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'done' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('status', 'done');
        });

        it('should update task priority', async () => {
            const res = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ priority: 'high' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('priority', 'high');
        });

        it('should fail with invalid status', async () => {
            const res = await request(app)
                .put(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ status: 'invalid-status' });

            expect(res.statusCode).toBe(400);
        });
    });

    describe('DELETE /api/tasks/:id', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Delete Task', project: projectId });
            taskId = res.body._id;
        });

        it('should delete task', async () => {
            const res = await request(app)
                .delete(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.msg).toContain('removed');

            // Verify task is gone
            const getRes = await request(app)
                .get(`/api/tasks/${taskId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getRes.statusCode).toBe(404);
        });
    });

    describe('POST /api/tasks/:id/comments', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Comment Task', project: projectId });
            taskId = res.body._id;
        });

        it('should add a comment to task', async () => {
            const res = await request(app)
                .post(`/api/tasks/${taskId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ text: 'This is a comment' });

            expect(res.statusCode).toBe(200);
            expect(res.body.comments.length).toBe(1);
            expect(res.body.comments[0].text).toBe('This is a comment');
        });

        it('should fail without comment text', async () => {
            const res = await request(app)
                .post(`/api/tasks/${taskId}/comments`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(res.statusCode).toBe(400);
        });
    });

    describe('POST /api/tasks/:id/assign', () => {
        let taskId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Assign Task', project: projectId });
            taskId = res.body._id;
        });

        it('should assign user to task', async () => {
            const res = await request(app)
                .post(`/api/tasks/${taskId}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId });

            expect(res.statusCode).toBe(200);
            const assigneeIds = res.body.assignees.map(a => a._id);
            expect(assigneeIds).toContain(userId);
        });

        it('should fail if user already assigned', async () => {
            await request(app)
                .post(`/api/tasks/${taskId}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId });

            const res = await request(app)
                .post(`/api/tasks/${taskId}/assign`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toContain('already');
        });
    });

    describe('GET /api/tasks/search/text', () => {
        beforeEach(async () => {
            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Bug Fix Task', description: 'Fix the login bug', project: projectId });

            await request(app)
                .post('/api/tasks')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ title: 'Feature Request', description: 'Add new feature', project: projectId });
        });

        it('should search tasks by title', async () => {
            const res = await request(app)
                .get('/api/tasks/search/text?q=Bug')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('results');
            expect(res.body.results.length).toBeGreaterThan(0);
        });

        it('should return empty results for no matches', async () => {
            const res = await request(app)
                .get('/api/tasks/search/text?q=nonexistentterm123xyz')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.results.length).toBe(0);
        });

        it('should fail without search query', async () => {
            const res = await request(app)
                .get('/api/tasks/search/text')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(400);
        });
    });
});
