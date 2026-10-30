import bcrypt from 'bcrypt';
import prisma from './prismaClient';
import logger from './utils/logger';
import { invalidatePublicApiKeyCache } from './middleware/publicApiKey';

export async function bootstrapAdmin(): Promise<void> {
  const publicApiKey = process.env.PUBLIC_API_KEY?.trim();
  if (publicApiKey) {
    await prisma.systemConfig.upsert({
      where: { key: 'public_api_key' },
      update: { value: publicApiKey },
      create: { key: 'public_api_key', value: publicApiKey },
    });
    invalidatePublicApiKeyCache();
    logger.info('Storefront public API key is ready');
  }

  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (!password) return;

  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@ruyaaessentials.com').toLowerCase().trim();
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE',
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: {
      name: 'Ruyaa Admin',
      email,
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash,
    },
  });
  logger.info(`Admin login is ready for ${email}`);
}
