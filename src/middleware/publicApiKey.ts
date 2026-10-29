import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient';

// In-memory cache so we don't hit the DB on every public request
let cachedKey: string | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 1000; // refresh from DB every 60s

export async function getPublicApiKeyFromDb(): Promise<string | null> {
  const now = Date.now();
  if (cachedKey !== null && now < cacheExpiry) return cachedKey;

  const row = await prisma.systemConfig.findUnique({ where: { key: 'public_api_key' } });
  cachedKey = row?.value ?? null;
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedKey;
}

export function invalidatePublicApiKeyCache(): void {
  cachedKey = null;
  cacheExpiry = 0;
}

export async function publicApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const providedKey = req.headers['x-api-key'];

  if (!providedKey || typeof providedKey !== 'string') {
    res.status(401).json({ success: false, error: 'Missing API key' });
    return;
  }

  try {
    const expectedKey = await getPublicApiKeyFromDb();

    if (!expectedKey) {
      res.status(503).json({ success: false, error: 'Public API not configured' });
      return;
    }

    const provided = Buffer.from(providedKey);
    const expected = Buffer.from(expectedKey);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      res.status(401).json({ success: false, error: 'Invalid API key' });
      return;
    }
  } catch {
    res.status(401).json({ success: false, error: 'Invalid API key' });
    return;
  }

  next();
}
