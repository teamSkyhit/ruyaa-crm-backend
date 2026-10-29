import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { EntityType, ActionType } from '@prisma/client';

const VALID_ENTITY_TYPES = new Set<EntityType>([
  'PRODUCT',
  'USER',
  'CATEGORY',
  'ORDER',
  'CUSTOMER',
  'BANNER',
  'SITE_SETTINGS',
  'ENQUIRY',
]);

const VALID_ACTIONS = new Set<ActionType>(['CREATE', 'UPDATE', 'DELETE']);

export async function getActivityLogs(req: Request, res: Response): Promise<void> {
  try {
    const { page = '1', limit = '20', entityType, action, startDate, endDate } = req.query;

    const pageNum = Math.max(parseInt(String(page)) || 1, 1);
    const limitNum = Math.min(parseInt(String(limit)) || 20, 100);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (entityType && VALID_ENTITY_TYPES.has(String(entityType).toUpperCase() as EntityType)) {
      where.entityType = String(entityType).toUpperCase() as EntityType;
    }

    if (action && VALID_ACTIONS.has(String(action).toUpperCase() as ActionType)) {
      where.action = String(action).toUpperCase() as ActionType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(String(startDate));
      if (endDate) where.createdAt.lte = new Date(String(endDate));
    }

    const [total, logs] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
      }),
    ]);

    res.json({
      success: true,
      data: logs,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (err) {
    console.error('[ACTIVITY] getActivityLogs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createActivityLog({
  entityType,
  entityId,
  entityName,
  action,
  details,
  userId,
  ipAddress,
}: {
  entityType: EntityType;
  entityId: string;
  entityName: string;
  action: ActionType;
  details?: string;
  userId?: string;
  ipAddress?: string;
}): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: { entityType, entityId, entityName, action, details, userId, ipAddress },
    });
  } catch (err) {
    console.error('[ACTIVITY] createActivityLog error:', err);
    // Don't throw — activity logging must never break the main operation
  }
}
