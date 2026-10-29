import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { sendNewsletterBroadcast } from '../services/resendService';

export async function listSubscribers(req: Request, res: Response): Promise<void> {
  try {
    const { isActive, page = '1', limit = '20' } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (isActive === 'true') where.isActive = true;
    else if (isActive === 'false') where.isActive = false;

    const [subscribers, total] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        take,
        skip,
      }),
      prisma.newsletterSubscriber.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        subscribers,
        pagination: {
          total,
          page: Number(page),
          limit: take,
          pages: Math.ceil(total / take),
        },
      },
    });
  } catch (err) {
    console.error('[NEWSLETTER] listSubscribers error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function toggleSubscriber(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ success: false, error: 'Subscriber not found' });
      return;
    }

    const subscriber = await prisma.newsletterSubscriber.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
    });

    res.json({ success: true, data: subscriber });
  } catch (err) {
    console.error('[NEWSLETTER] toggleSubscriber error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function broadcastNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const { subject, html } = req.body as { subject?: string; html?: string };
    if (!subject || !html) {
      res.status(400).json({ success: false, error: 'subject and html are required' });
      return;
    }

    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      select: { email: true },
    });

    if (subscribers.length === 0) {
      res.json({ success: true, data: { sent: 0, failed: 0, total: 0 } });
      return;
    }

    const emails = subscribers.map((s) => s.email);
    const { sent, failed } = await sendNewsletterBroadcast(subject, html, emails);

    res.json({ success: true, data: { sent, failed, total: subscribers.length } });
  } catch (err) {
    console.error('[NEWSLETTER] broadcastNewsletter error:', err);
    res.status(500).json({ success: false, error: 'Failed to send broadcast' });
  }
}

export async function exportCSV(req: Request, res: Response): Promise<void> {
  try {
    const subscribers = await prisma.newsletterSubscriber.findMany({
      where: { isActive: true },
      orderBy: { subscribedAt: 'asc' },
      select: { email: true, subscribedAt: true, source: true },
    });

    const header = 'email,subscribedAt,source';
    const rows = subscribers.map(
      (s) =>
        `${s.email},${s.subscribedAt.toISOString()},${s.source}`
    );
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="newsletter-subscribers.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[NEWSLETTER] exportCSV error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
