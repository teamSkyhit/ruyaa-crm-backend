import bcrypt from 'bcrypt';
import prisma from './prismaClient';
import logger from './utils/logger';

export async function bootstrapAdmin(): Promise<void> {
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
