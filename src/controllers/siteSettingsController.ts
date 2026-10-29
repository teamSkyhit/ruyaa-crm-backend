import { Request, Response } from 'express';
import prisma from '../prismaClient';

export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { singleton: 'global' },
    });

    if (!settings) {
      settings = await prisma.siteSettings.create({
        data: { singleton: 'global' },
      });
    }

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[SITE_SETTINGS] getSettings error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  try {
    // Strip fields that must never be written here
    const {
      id: _id,
      singleton: _singleton,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...updateData
    } = req.body;

    const settings = await prisma.siteSettings.upsert({
      where: { singleton: 'global' },
      update: updateData,
      create: { singleton: 'global', ...updateData },
    });

    res.json({ success: true, data: settings });
  } catch (err) {
    console.error('[SITE_SETTINGS] updateSettings error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
