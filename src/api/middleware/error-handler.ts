// Error Handling Middleware
// Centralized error handling and 404 responses

import { Request, Response, NextFunction } from 'express'

// ============================================================================
// CUSTOM ERROR CLASSES
// ============================================================================

export class AppError extends Error {
    constructor(
        public statusCode: number,
        public message: string,
        public code?: string
    ) {
        super(message)
        Object.setPrototypeOf(this, AppError.prototype)
    }
}

export class ValidationError extends AppError {
    constructor(message: string, public fields?: Record<string, string>) {
        super(400, message, 'VALIDATION_ERROR')
        Object.setPrototypeOf(this, ValidationError.prototype)
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string, identifier?: string) {
        const message = identifier
            ? `${resource} with id "${identifier}" not found`
            : `${resource} not found`
        super(404, message, 'NOT_FOUND')
        Object.setPrototypeOf(this, NotFoundError.prototype)
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string = 'Unauthorized') {
        super(401, message, 'UNAUTHORIZED')
        Object.setPrototypeOf(this, UnauthorizedError.prototype)
    }
}

export class ForbiddenError extends AppError {
    constructor(message: string = 'Forbidden') {
        super(403, message, 'FORBIDDEN')
        Object.setPrototypeOf(this, ForbiddenError.prototype)
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(409, message, 'CONFLICT')
        Object.setPrototypeOf(this, ConflictError.prototype)
    }
}

// ============================================================================
// ERROR HANDLER MIDDLEWARE
// ============================================================================

export function errorHandler(
    error: Error | AppError,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    console.error('Error:', error)

    // Default error response
    let statusCode = 500
    let message = 'Internal Server Error'
    let code = 'INTERNAL_SERVER_ERROR'
    let details: any = undefined

    // Handle custom AppError
    if (error instanceof AppError) {
        statusCode = error.statusCode
        message = error.message
        code = error.code || 'APP_ERROR'

        if (error instanceof ValidationError && error.fields) {
            details = {
                fields: error.fields
            }
        }
    }
    // Handle MongoDB validation error
    else if (error.name === 'ValidationError') {
        statusCode = 400
        message = 'Validation Error'
        code = 'VALIDATION_ERROR'
    }
    // Handle MongoDB duplicate key error
    else if (error.name === 'MongoServerError' && (error as any).code === 11000) {
        statusCode = 409
        message = 'Duplicate key error'
        code = 'DUPLICATE_KEY'
        const field = Object.keys((error as any).keyValue)[0]
        details = { field, value: (error as any).keyValue[field] }
    }
    // Handle PostgreSQL errors
    else if ((error as any).code && (error as any).routine) {
        statusCode = 400
        message = 'Database error'
        code = (error as any).code
    }
    // Handle JWT errors
    else if (error.name === 'JsonWebTokenError') {
        statusCode = 401
        message = 'Invalid token'
        code = 'INVALID_TOKEN'
    }
    else if (error.name === 'TokenExpiredError') {
        statusCode = 401
        message = 'Token expired'
        code = 'TOKEN_EXPIRED'
    }

    // Build response
    const response: any = {
        error: {
            code,
            message
        }
    }

    if (details) {
        response.error.details = details
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.error.stack = error.stack
    }

    // Add request info for debugging
    if (process.env.NODE_ENV === 'development') {
        response.request = {
            method: req.method,
            url: req.url,
            timestamp: new Date().toISOString()
        }
    }

    res.status(statusCode).json(response)
}

// ============================================================================
// 404 NOT FOUND HANDLER
// ============================================================================

export function notFoundHandler(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const error = new NotFoundError(`Route ${req.method} ${req.path}`)
    errorHandler(error, req, res, next)
}

// ============================================================================
// ASYNC HANDLER WRAPPER
// ============================================================================

/**
 * Wrap async route handlers to catch errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
export function asyncHandler(
    fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
