// src/middleware/auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';
import { AuthToken } from '../types';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}
const secret = process.env.JWT_SECRET;

interface JwtPayload {
  // New shape (15-min access token)
  userId?: string;
  // Legacy shape (8-hour token) — kept for backward compat during rotation
  id?: string;
  email: string;
  role: string;
}

async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn('[AUTH] Missing or invalid Authorization header:', {
      path: req.path,
      hasHeader: !!authHeader,
      headerPreview: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
    });
    res.status(401).json({ success: false, error: 'Unauthorized - Missing or invalid token' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    // Support both new (userId) and legacy (id) JWT payload shapes
    const resolvedId = payload.userId ?? payload.id;
    const user = await prisma.user.findUnique({ where: { id: resolvedId } });
    if (!user || user.status !== 'ACTIVE') {
      console.warn('[AUTH] User not found or inactive:', {
        userId: resolvedId,
        userFound: !!user,
        userStatus: user?.status,
      });
      res.status(401).json({ success: false, error: 'Unauthorized - User not found or inactive' });
      return;
    }
    req.user = { userId: user.id, role: user.role, email: user.email };
    next();
  } catch (err) {
    console.error('[AUTH] Token verification failed:', {
      error: err instanceof Error ? err.message : String(err),
      path: req.path,
    });
    res.status(401).json({ 
      success: false, 
      error: err instanceof jwt.TokenExpiredError 
        ? 'Token expired - Please login again' 
        : 'Invalid token' 
    });
  }
}

function adminOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized' });
    return;
  }
  if (req.user.role !== 'ADMIN') {
    res.status(403).json({ success: false, error: 'Forbidden' });
    return;
  }
  next();
}

export { authMiddleware, adminOnly };
