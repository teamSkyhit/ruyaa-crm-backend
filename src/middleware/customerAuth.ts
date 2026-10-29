import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import prisma from '../prismaClient';

if (!process.env.CUSTOMER_JWT_SECRET || process.env.CUSTOMER_JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: CUSTOMER_JWT_SECRET missing or too short (min 32 chars).'
  );
}

const secret = process.env.CUSTOMER_JWT_SECRET;

interface CustomerJwtPayload {
  customerId: string;
  email: string;
  type?: 'access' | 'refresh';
}

export function signCustomerAccessToken(customerId: string, email: string): string {
  const expiresIn = (process.env.CUSTOMER_JWT_EXPIRES_IN || '15m') as jwt.SignOptions['expiresIn'];
  return jwt.sign({ customerId, email, type: 'access' }, secret, { expiresIn });
}

export function signCustomerRefreshToken(customerId: string, email: string): string {
  const expiresIn = (process.env.CUSTOMER_REFRESH_EXPIRES_IN || '30d') as jwt.SignOptions['expiresIn'];
  return jwt.sign({ customerId, email, type: 'refresh' }, secret, {
    expiresIn,
    jwtid: crypto.randomBytes(16).toString('hex'),
  });
}

export function verifyCustomerToken(token: string): CustomerJwtPayload {
  return jwt.verify(token, secret) as CustomerJwtPayload;
}

export const CUSTOMER_REFRESH_COOKIE: import('express').CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  path: '/api/customer',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function readBearer(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1] || null;
}

export async function customerAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = readBearer(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized - Missing or invalid token' });
    return;
  }

  try {
    const payload = verifyCustomerToken(token);
    if (payload.type === 'refresh' || !payload.customerId || !payload.email) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer || !customer.isActive || !customer.email) {
      res.status(401).json({ error: 'Unauthorized - Customer not found or inactive' });
      return;
    }

    req.customer = { id: customer.id, email: customer.email };
    next();
  } catch (err) {
    res.status(401).json({
      error: err instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token',
    });
  }
}

/** Guest checkout stays open. A present but invalid token is rejected. */
export async function optionalCustomer(
  req: Request
): Promise<{ id: string; email: string } | null> {
  const token = readBearer(req);
  if (!token) return null;

  const payload = verifyCustomerToken(token);
  if (payload.type === 'refresh' || !payload.customerId) {
    throw new Error('INVALID_CUSTOMER_TOKEN');
  }

  const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
  if (!customer || !customer.isActive || !customer.email) {
    throw new Error('INVALID_CUSTOMER_TOKEN');
  }

  return { id: customer.id, email: customer.email };
}
