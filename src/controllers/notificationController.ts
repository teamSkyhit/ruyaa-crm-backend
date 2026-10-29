import { Request, Response } from 'express';
import prisma from '../prismaClient';

export async function listNotifications(req: Request, res: Response): Promise<void> {
  try {
    const unreadOnly = req.query.unread === 'true';
    const [items, unread] = await Promise.all([
      prisma.adminNotification.findMany({
        where: unreadOnly ? { readAt: null } : {},
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.adminNotification.count({ where: { readAt: null } }),
    ]);
    res.json({ success: true, data: items, unread });
  } catch (error) {
    console.error('listNotifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
}

export async function markNotificationRead(req: Request, res: Response): Promise<void> {
  try {
    const item = await prisma.adminNotification.update({
      where: { id: req.params.id },
      data: { readAt: new Date() },
    });
    res.json({ success: true, data: item });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Notification not found' });
      return;
    }
    console.error('markNotificationRead error:', error);
    res.status(500).json({ success: false, error: 'Failed to update notification' });
  }
}

export async function markAllNotificationsRead(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.adminNotification.updateMany({ where: { readAt: null }, data: { readAt: new Date() } });
    res.json({ success: true });
  } catch (error) {
    console.error('markAllNotificationsRead error:', error);
    res.status(500).json({ success: false, error: 'Failed to update notifications' });
  }
}
