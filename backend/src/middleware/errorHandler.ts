import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { sendError } from '../utils/response';

export class AppError extends Error {
  statusCode: number;
  details?: any;

  constructor(message: string, statusCode = 400, details?: any) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  console.error('Unhandled Error:', err);

  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.details);
  }

  if (err instanceof ZodError) {
    const formatted = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return sendError(res, 'Validation failed', 422, formatted);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 'Invalid token', 401);
  }
  if (err.name === 'TokenExpiredError') {
    return sendError(res, 'Token has expired', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  return sendError(res, message, statusCode);
}
