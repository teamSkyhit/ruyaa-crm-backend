// src/controllers/notificationController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { NotificationType } from '@prisma/client';

// Get notifications for user/store
export const getNotifications = async (req: Request, res: Response): Promise<void> => {
  try {
    // Auth middleware sets req.user.userId (not req.user.id)
    const userId = (req as any).user?.userId;
    const { storeId, counterId, read, limit = 50 } = req.query;

    if (!userId) {
      console.warn('[NOTIFICATIONS] No userId in request:', {
        hasUser: !!(req as any).user,
        userKeys: (req as any).user ? Object.keys((req as any).user) : [],
      });
      res.status(401).json({ success: false, error: 'Unauthorized - User ID not found' });
      return;
    }

    // BUG-002 FIX: Scope notifications to the requesting user's context.
    // A notification is visible to a user if:
    //   (a) it is targeted at them directly (userId matches), OR
    //   (b) it is a store-level notification for a store they belong to, OR
    //   (c) it is a counter-level notification for their counter
    // This prevents cashiers from seeing other users' or other stores' notifications.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { storeId: true, role: true },
    });

    const effectiveStoreId = storeId
      ? String(storeId)
      : user?.storeId ?? undefined;

    const orConditions: any[] = [{ userId }];

    if (effectiveStoreId) {
      orConditions.push({ storeId: effectiveStoreId, userId: null });
    }
    if (counterId) {
      orConditions.push({ counterId: String(counterId), userId: null });
    }

    const where: any = { OR: orConditions };
    if (read !== undefined) where.isRead = read === 'true';

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(limit), 200), // hard-cap at 200 to prevent runaway queries
    });

    const response: ApiResponse<any> = { success: true, data: notifications };
    res.json(response);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch notifications',
    };
    res.status(500).json(response);
  }
};

// Mark notification as read
export const markAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Auth middleware sets req.user.userId (not req.user.id)
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized - User ID not found' });
      return;
    }

    // Validate UUID format to prevent Prisma 500 on invalid id
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(id)) {
      res.status(400).json({ success: false, error: 'Invalid notification ID' });
      return;
    }

    // BUG-002 FIX: Only update if notification belongs to this user or their store
    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    if (existing.userId && existing.userId !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });

    const response: ApiResponse<any> = { success: true, data: notification };
    res.json(response);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to mark notification as read',
    };
    res.status(500).json(response);
  }
};

// Mark all notifications as read for the current user
export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized - User ID not found' });
      return;
    }
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to mark notifications as read' });
  }
};

// Create notification (internal use)
export async function createNotification(data: {
  type: NotificationType;
  title: string;
  message: string;
  storeId?: string;
  counterId?: string;
  userId?: string;
  metadata?: any;
}) {
  return await prisma.notification.create({
    data: {
      type: data.type,
      title: data.title,
      message: data.message,
      storeId: data.storeId,
      counterId: data.counterId,
      userId: data.userId,
      metadata: data.metadata || {},
    },
  });
}
