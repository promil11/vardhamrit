import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { sendError } from '../utils/response';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return sendError(res, 'Authentication required. Missing or invalid Bearer token.', 401);
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    return next();
  } catch (err: any) {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = verifyAccessToken(token);
      req.user = payload;
    } catch (_) {
      // Ignore token failure for optional endpoints
    }
  }
  return next();
}

export function requireRole(...allowedRoles: Array<'customer' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, 'Forbidden: Insufficient privileges', 403);
    }
    return next();
  };
}
