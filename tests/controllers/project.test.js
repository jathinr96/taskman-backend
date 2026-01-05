const request = require('supertest');
const createTestApp = require('../testApp');

const app = createTestApp();

describe('Project Controller', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
        // Create and login a user for each test
        const res = await request(app)
            .post('/api/auth/register')
            .send({
                name: 'Project Test User',
                email: 'project@example.com',
                password: 'password123'
            });
        authToken = res.body.token;
        userId = res.body._id;
    });

    describe('POST /api/projects', () => {
        it('should create a new project', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Test Project',
                    description: 'A test project description'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('name', 'Test Project');
            expect(res.body).toHaveProperty('description', 'A test project description');
        });

        it('should fail without authentication', async () => {
            const res = await request(app)
                .post('/api/projects')
                .send({
                    name: 'Test Project'
                });

            expect(res.statusCode).toBe(401);
        });

        it('should fail without project name', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    description: 'Description only'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should add creator as a member', async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Member Test Project'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.members).toContain(userId);
        });
    });

    describe('GET /api/projects', () => {
        it('should get all projects for user', async () => {
            // Create a project first
            await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Project 1' });

            await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Project 2' });

            const res = await request(app)
                .get('/api/projects')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBe(2);
        });

        it('should return empty array if no projects', async () => {
            const res = await request(app)
                .get('/api/projects')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toEqual([]);
        });
    });

    describe('GET /api/projects/:id', () => {
        let projectId;

        beforeEach(async () => {
            const res = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Get By ID Project' });
            projectId = res.body._id;
        });

        it('should get project by ID', async () => {
            const res = await request(app)
                .get(`/api/projects/${projectId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('name', 'Get By ID Project');
        });

        it('should fail with invalid ID format', async () => {
            const res = await request(app)
                .get('/api/projects/invalidid')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(400);
        });

        it('should return 404 for non-existent project', async () => {
            const res = await request(app)
                .get('/api/projects/507f1f77bcf86cd799439011')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(404);
        });
    });

    describe('POST /api/projects/:id/members', () => {
        let projectId;
        let newUserId;

        beforeEach(async () => {
            // Create project
            const projectRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Member Test Project' });
            projectId = projectRes.body._id;

            // Create another user
            const userRes = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'New Member',
                    email: 'newmember@example.com',
                    password: 'password123'
                });
            newUserId = userRes.body._id;
        });

        it('should add a member to project', async () => {
            const res = await request(app)
                .post(`/api/projects/${projectId}/members`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: newUserId });

            expect(res.statusCode).toBe(200);
            // Response returns members array
            const memberIds = res.body.map(m => m._id);
            expect(memberIds).toContain(newUserId);
        });

        it('should fail if user is already a member', async () => {
            // Add member first
            await request(app)
                .post(`/api/projects/${projectId}/members`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: newUserId });

            // Try to add again
            const res = await request(app)
                .post(`/api/projects/${projectId}/members`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: newUserId });

            expect(res.statusCode).toBe(400);
            expect(res.body.msg).toContain('already');
        });
    });

    describe('DELETE /api/projects/:id/members/:userId', () => {
        let projectId;
        let newUserId;

        beforeEach(async () => {
            // Create project
            const projectRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ name: 'Remove Member Test Project' });
            projectId = projectRes.body._id;

            // Create and add another user
            const userRes = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Member To Remove',
                    email: 'remove@example.com',
                    password: 'password123'
                });
            newUserId = userRes.body._id;

            await request(app)
                .post(`/api/projects/${projectId}/members`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({ userId: newUserId });
        });

        it('should remove a member from project', async () => {
            const res = await request(app)
                .delete(`/api/projects/${projectId}/members/${newUserId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.statusCode).toBe(200);
            // Response returns members array
            const memberIds = res.body.map(m => m._id);
            expect(memberIds).not.toContain(newUserId);
        });
    });
});
