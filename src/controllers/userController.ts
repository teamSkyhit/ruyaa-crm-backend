import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { UserRole, UserStatus } from '@prisma/client';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listUsers(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10));
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10)));
    const role = req.query.role as UserRole | undefined;
    const status = req.query.status as UserStatus | undefined;

    const where: { role?: UserRole; status?: UserStatus } = {};
    if (role && Object.values(UserRole).includes(role)) where.role = role;
    if (status && Object.values(UserStatus).includes(status)) where.status = status;

    const [total, users] = await prisma.$transaction([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    res.json({
      success: true,
      data: users,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    } satisfies ApiResponse);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch users' } satisfies ApiResponse);
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: USER_SELECT,
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' } satisfies ApiResponse);
      return;
    }
    res.json({ success: true, data: user } satisfies ApiResponse);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch user' } satisfies ApiResponse);
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, password, role = 'USER' } = req.body;
    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already exists' } satisfies ApiResponse);
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: normalizedEmail,
        passwordHash,
        role: role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER,
      },
      select: USER_SELECT,
    });

    res.status(201).json({ success: true, data: user, message: 'User created successfully' } satisfies ApiResponse);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Email already exists' } satisfies ApiResponse);
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create user' } satisfies ApiResponse);
  }
}

export async function updateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, email, role, status } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' } satisfies ApiResponse);
      return;
    }

    if (email) {
      const normalizedEmail = String(email).toLowerCase().trim();
      if (normalizedEmail !== existing.email) {
        const taken = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (taken) {
          res.status(400).json({ success: false, error: 'Email already exists' } satisfies ApiResponse);
          return;
        }
      }
    }

    const data: { name?: string; email?: string; role?: UserRole; status?: UserStatus } = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = String(email).toLowerCase().trim();
    if (role !== undefined) data.role = role === 'ADMIN' ? UserRole.ADMIN : UserRole.USER;
    if (status !== undefined) data.status = status === 'INACTIVE' ? UserStatus.INACTIVE : UserStatus.ACTIVE;

    const user = await prisma.user.update({ where: { id }, data, select: USER_SELECT });

    res.json({ success: true, data: user, message: 'User updated successfully' } satisfies ApiResponse);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Email already exists' } satisfies ApiResponse);
      return;
    }
    if (err?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'User not found' } satisfies ApiResponse);
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update user' } satisfies ApiResponse);
  }
}

export async function deactivateUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' } satisfies ApiResponse);
      return;
    }

    await prisma.user.update({ where: { id }, data: { status: UserStatus.INACTIVE } });

    res.json({ success: true, message: 'User deactivated successfully' } satisfies ApiResponse);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to deactivate user' } satisfies ApiResponse);
  }
}

export async function unlockUser(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'User not found' } satisfies ApiResponse);
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });

    res.json({ success: true, message: 'User unlocked successfully' } satisfies ApiResponse);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to unlock user' } satisfies ApiResponse);
  }
}
