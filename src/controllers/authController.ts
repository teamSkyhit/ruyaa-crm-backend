import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { sendPasswordResetEmail } from '../services/resendService';
import { logSecurityEvent } from '../utils/logger';

if (!process.env.JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
}
const secret = process.env.JWT_SECRET;
const TOKEN_EXPIRES = '15m';
const REFRESH_EXPIRES_DAYS = 7;

const MAX_FAILED_ATTEMPTS = Number(process.env.LOCKOUT_ATTEMPTS ?? 5);
const LOCKOUT_DURATION_MS = Number(process.env.LOCKOUT_DURATION_MS ?? 15 * 60 * 1000);

const REFRESH_COOKIE: import('express').CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth',
  maxAge: REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
};

function hashToken(token: string): string {
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}

function safeUser(user: { id: string; name: string; email: string; role: string }) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Unknown email — generic error (prevents enumeration)
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      logSecurityEvent('account_locked_login_attempt', {
        email: normalizedEmail,
        ip: req.ip,
        lockedUntil: user.lockedUntil,
      });
      res.status(429).json({ success: false, error: 'Account temporarily locked due to too many failed attempts. Please try again later.' });
      return;
    }

    // Verify password
    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      const attempts = user.failedLoginAttempts + 1;
      const lockData: { failedLoginAttempts: number; lockedUntil?: Date } = { failedLoginAttempts: attempts };
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        lockData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
        logSecurityEvent('account_locked', {
          email: normalizedEmail,
          ip: req.ip,
          attempts,
          lockedUntil: lockData.lockedUntil,
        });
      } else {
        logSecurityEvent('failed_login', {
          email: normalizedEmail,
          ip: req.ip,
          attempts,
        });
      }
      await prisma.user.update({ where: { id: user.id }, data: lockData });
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(401).json({ success: false, error: 'Account is inactive' });
      return;
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      secret,
      { expiresIn: TOKEN_EXPIRES }
    );
    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.create({ data: { tokenHash, userId: user.id, expiresAt } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } }),
    ]);

    logSecurityEvent('login_success', { userId: user.id, email: user.email, ip: req.ip });

    res.cookie('refreshToken', rawRefreshToken, REFRESH_COOKIE);
    res.json({
      success: true,
      data: {
        accessToken,
        expiresIn: 900,
        user: safeUser(user),
      },
    } satisfies ApiResponse);
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function refresh(req: Request, res: Response): Promise<void> {
  try {
    const raw: string | undefined = req.cookies?.refreshToken;
    if (!raw || typeof raw !== 'string') {
      res.status(401).json({ success: false, error: 'Refresh token required' });
      return;
    }

    const tokenHash = hashToken(raw);
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    const newRaw = crypto.randomBytes(64).toString('hex');
    const newHash = hashToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction([
      prisma.refreshToken.update({ where: { tokenHash }, data: { revokedAt: new Date() } }),
      prisma.refreshToken.create({ data: { tokenHash: newHash, userId: user.id, expiresAt } }),
    ]);

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role, email: user.email },
      secret,
      { expiresIn: TOKEN_EXPIRES }
    );

    res.cookie('refreshToken', newRaw, REFRESH_COOKIE);
    res.json({ success: true, data: { accessToken, expiresIn: 900 } });
  } catch {
    res.status(500).json({ success: false, error: 'Token refresh failed' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const raw: string | undefined = req.cookies?.refreshToken;
    if (raw && typeof raw === 'string') {
      const tokenHash = hashToken(raw);
      await prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.clearCookie('refreshToken', { ...REFRESH_COOKIE, maxAge: undefined });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch {
    res.clearCookie('refreshToken', { ...REFRESH_COOKIE, maxAge: undefined });
    res.json({ success: true, message: 'Logged out successfully' });
  }
}

export async function getMe(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true, lastLoginAt: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    res.json({ success: true, data: { user } });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.status !== 'ACTIVE') {
      res.status(401).json({ success: false, error: 'User not found or inactive' });
      return;
    }

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } }),
      prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

    // Always respond 200 to prevent email enumeration
    if (!user || user.status !== 'ACTIVE') {
      res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
      return;
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpiry: expiry },
    });

    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(normalizedEmail, resetUrl);

    res.json({ success: true, message: 'If that email exists, a reset link has been sent.' });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, error: 'Token and new password are required' });
      return;
    }

    const tokenHash = hashToken(String(token));
    const user = await prisma.user.findFirst({
      where: { passwordResetToken: tokenHash },
    });

    if (!user) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    if (!user.passwordResetExpiry || user.passwordResetExpiry < new Date()) {
      res.status(400).json({ success: false, error: 'Invalid or expired reset token' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetToken: null, passwordResetExpiry: null },
      }),
      // Revoke all active sessions so a stolen refresh token can't be used post-reset
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    res.json({ success: true, message: 'Password reset successfully' });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
