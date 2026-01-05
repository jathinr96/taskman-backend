const request = require('supertest');
const createTestApp = require('../testApp');
const User = require('../../models/User');

const app = createTestApp();

describe('Auth Controller', () => {
    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('name', 'Test User');
            expect(res.body).toHaveProperty('email', 'test@example.com');
            expect(res.body).not.toHaveProperty('password');
        });

        it('should fail with invalid email', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'invalid-email',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should fail with short password', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'test@example.com',
                    password: '123'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should fail with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should fail if email already exists', async () => {
            // First registration
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Test User',
                    email: 'duplicate@example.com',
                    password: 'password123'
                });

            // Second registration with same email
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Another User',
                    email: 'duplicate@example.com',
                    password: 'password456'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.message).toContain('exists');
        });
    });

    describe('POST /api/auth/login', () => {
        beforeEach(async () => {
            // Create a user for login tests
            await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Login Test User',
                    email: 'login@example.com',
                    password: 'password123'
                });
        });

        it('should login successfully with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('token');
            expect(res.body).toHaveProperty('email', 'login@example.com');
        });

        it('should fail with wrong password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'wrongpassword'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toContain('Invalid');
        });

        it('should fail with non-existent email', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'nonexistent@example.com',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.message).toContain('Invalid');
        });

        it('should fail with missing fields', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com'
                });

            expect(res.statusCode).toBe(400);
        });

        it('should return token that can be used for authentication', async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'login@example.com',
                    password: 'password123'
                });

            const token = loginRes.body.token;

            // Try to access a protected route
            const projectsRes = await request(app)
                .get('/api/projects')
                .set('Authorization', `Bearer ${token}`);

            expect(projectsRes.statusCode).toBe(200);
        });
    });

    describe('Authentication Middleware', () => {
        it('should fail without token', async () => {
            const res = await request(app)
                .get('/api/projects');

            expect(res.statusCode).toBe(401);
        });

        it('should fail with invalid token', async () => {
            const res = await request(app)
                .get('/api/projects')
                .set('Authorization', 'Bearer invalidtoken123');

            expect(res.statusCode).toBe(401);
        });

        it('should succeed with valid token', async () => {
            const registerRes = await request(app)
                .post('/api/auth/register')
                .send({
                    name: 'Token Test User',
                    email: 'token@example.com',
                    password: 'password123'
                });

            const token = registerRes.body.token;

            const res = await request(app)
                .get('/api/projects')
                .set('Authorization', `Bearer ${token}`);

            expect(res.statusCode).toBe(200);
        });
    });
});
