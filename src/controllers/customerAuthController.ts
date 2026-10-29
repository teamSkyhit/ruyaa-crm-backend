import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { sendCustomerOtp } from '../services/resendService';
import {
  CUSTOMER_REFRESH_COOKIE,
  signCustomerAccessToken,
  signCustomerRefreshToken,
  verifyCustomerToken,
} from '../middleware/customerAuth';

const OTP_TTL_MS = 10 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashOtp(otp: string): string {
  return crypto.createHmac('sha256', process.env.CUSTOMER_JWT_SECRET!).update(otp).digest('hex');
}

function hashCustomerRefresh(token: string): string {
  return crypto.createHmac('sha256', process.env.CUSTOMER_JWT_SECRET!).update(`refresh:${token}`).digest('hex');
}

function refreshExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

async function storeCustomerRefresh(customerId: string, rawToken: string): Promise<void> {
  await prisma.customerRefreshToken.create({
    data: {
      tokenHash: hashCustomerRefresh(rawToken),
      customerId,
      expiresAt: refreshExpiry(),
    },
  });
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export async function requestOtp(req: Request, res: Response): Promise<void> {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email || !EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'A valid email is required' });
      return;
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.customerOtp.count({
      where: { email, createdAt: { gte: since } },
    });
    if (recent >= 3) {
      res.status(429).json({ error: 'Too many OTP requests. Try again in an hour.' });
      return;
    }

    const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
    await prisma.customerOtp.create({
      data: {
        email,
        otp: hashOtp(otp),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    try {
      await sendCustomerOtp(email, otp);
    } catch (err) {
      if (process.env.NODE_ENV === 'production') {
        console.error('[requestOtp] email failed:', err);
        res.status(502).json({ error: 'Could not send OTP email' });
        return;
      }
      console.warn(`[requestOtp] Resend unavailable in development. OTP email was not sent to ${email}`);
    }

    res.json({ message: 'OTP sent to email' });
  } catch (error) {
    console.error('[requestOtp]', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
}

export async function verifyOtp(req: Request, res: Response): Promise<void> {
  try {
    const email = normalizeEmail(req.body?.email);
    const otp = String(req.body?.otp ?? '').trim();
    if (!email || !/^\d{6}$/.test(otp)) {
      res.status(400).json({ error: 'Email and a 6-digit OTP are required' });
      return;
    }

    const candidates = await prisma.customerOtp.findMany({
      where: { email, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const hashed = hashOtp(otp);
    const match = candidates.find((row) => {
      const stored = Buffer.from(row.otp);
      const incoming = Buffer.from(hashed);
      return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
    });

    if (!match) {
      res.status(400).json({ error: 'Invalid or expired OTP' });
      return;
    }

    await prisma.customerOtp.update({ where: { id: match.id }, data: { used: true } });

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing && !existing.isActive) {
      res.status(403).json({ error: 'This account is inactive' });
      return;
    }

    const customer = existing ?? await prisma.customer.create({
      data: { email, isActive: true },
    });

    const token = signCustomerAccessToken(customer.id, customer.email!);
    const refreshToken = signCustomerRefreshToken(customer.id, customer.email!);
    await storeCustomerRefresh(customer.id, refreshToken);
    res.cookie('refreshToken', refreshToken, CUSTOMER_REFRESH_COOKIE);

    res.json({
      token,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        phone: customer.phone,
        isNewUser: customer.name == null,
      },
    });
  } catch (error) {
    console.error('[verifyOtp]', error);
    res.status(500).json({ error: 'Failed to verify OTP' });
  }
}

export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.cookies?.refreshToken;
    if (!raw || typeof raw !== 'string') {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    const payload = verifyCustomerToken(raw);
    if (payload.type !== 'refresh' || !payload.customerId) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
    if (!customer || !customer.isActive || !customer.email) {
      res.status(401).json({ error: 'Customer not found or inactive' });
      return;
    }

    const stored = await prisma.customerRefreshToken.findUnique({
      where: { tokenHash: hashCustomerRefresh(raw) },
    });
    if (!stored || stored.customerId !== customer.id || stored.revokedAt || stored.expiresAt <= new Date()) {
      res.status(401).json({ error: 'Invalid or expired refresh token' });
      return;
    }

    const token = signCustomerAccessToken(customer.id, customer.email);
    const nextRefresh = signCustomerRefreshToken(customer.id, customer.email);
    await prisma.$transaction(async (tx) => {
      await tx.customerRefreshToken.create({
        data: {
          tokenHash: hashCustomerRefresh(nextRefresh),
          customerId: customer.id,
          expiresAt: refreshExpiry(),
        },
      });
      const claimed = await tx.customerRefreshToken.updateMany({
        where: { id: stored.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (claimed.count !== 1) {
        throw new Error('REFRESH_USED');
      }
    });
    res.cookie('refreshToken', nextRefresh, CUSTOMER_REFRESH_COOKIE);
    res.json({ token });
  } catch (error) {
    if (error instanceof Error && error.message !== 'REFRESH_USED') {
      console.error('[refresh]', error.name);
    }
    res.status(401).json({ error: 'Invalid or expired refresh token' });
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const raw = req.cookies?.refreshToken;
    if (typeof raw === 'string' && raw) {
      await prisma.customerRefreshToken.updateMany({
        where: { tokenHash: hashCustomerRefresh(raw), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
  } catch (error) {
    console.error('[logout]', error);
  }
  res.clearCookie('refreshToken', { ...CUSTOMER_REFRESH_COOKIE, maxAge: undefined });
  res.json({ message: 'Logged out' });
}
