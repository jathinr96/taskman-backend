const { AppError, notFound, errorHandler } = require('../../middleware/errorHandler');

describe('Error Handler Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        mockReq = {
            originalUrl: '/api/test'
        };
        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        mockNext = jest.fn();
    });

    describe('AppError class', () => {
        it('should create an error with message and status code', () => {
            const error = new AppError('Test error', 400);

            expect(error.message).toBe('Test error');
            expect(error.statusCode).toBe(400);
            expect(error.isOperational).toBe(true);
        });

        it('should be an instance of Error', () => {
            const error = new AppError('Test error', 500);

            expect(error).toBeInstanceOf(Error);
        });
    });

    describe('notFound middleware', () => {
        it('should create a 404 error with the URL', () => {
            notFound(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            const error = mockNext.mock.calls[0][0];
            expect(error.statusCode).toBe(404);
            expect(error.message).toContain('/api/test');
        });
    });

    describe('errorHandler middleware', () => {
        it('should handle AppError with correct status code', () => {
            const error = new AppError('Custom error', 400);

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Custom error'
                })
            );
        });

        it('should handle unknown errors with 500 status', () => {
            const error = new Error('Unknown error');

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Unknown error'
                })
            );
        });

        it('should handle Mongoose CastError', () => {
            const error = new Error('Cast error');
            error.name = 'CastError';
            error.kind = 'ObjectId';

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Invalid ID format'
                })
            );
        });

        it('should handle Mongoose duplicate key error', () => {
            const error = new Error('Duplicate');
            error.code = 11000;
            error.keyValue = { email: 'test@test.com' };

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'email already exists'
                })
            );
        });

        it('should handle Mongoose ValidationError', () => {
            const error = new Error('Validation error');
            error.name = 'ValidationError';
            error.errors = {
                name: { message: 'Name is required' },
                email: { message: 'Email is invalid' }
            };

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: expect.stringContaining('Name is required')
                })
            );
        });

        it('should handle JsonWebTokenError', () => {
            const error = new Error('Invalid token');
            error.name = 'JsonWebTokenError';

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Invalid token'
                })
            );
        });

        it('should handle TokenExpiredError', () => {
            const error = new Error('Token expired');
            error.name = 'TokenExpiredError';

            errorHandler(error, mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    message: 'Token expired'
                })
            );
        });
    });
});
