import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';

const createSchema = z.object({
  title: z.string().max(255).optional(),
  subtitle: z.string().optional(),
  imageUrl: z.string().min(1, 'imageUrl is required'),
  mobileImageUrl: z.string().optional(),
  ctaText: z.string().max(100).optional(),
  ctaUrl: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  validFrom: z.string().datetime().optional().nullable(),
  validUntil: z.string().datetime().optional().nullable(),
});

const updateSchema = createSchema.partial();

const reorderSchema = z.array(
  z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })
);

export async function listBanners(req: Request, res: Response): Promise<void> {
  try {
    const banners = await prisma.banner.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: banners });
  } catch (err) {
    console.error('[BANNER] listBanners error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function getBanner(req: Request, res: Response): Promise<void> {
  try {
    const banner = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!banner) {
      res.status(404).json({ success: false, error: 'Banner not found' });
      return;
    }
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error('[BANNER] getBanner error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function createBanner(req: Request, res: Response): Promise<void> {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const banner = await prisma.banner.create({ data: parsed.data as any });
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    console.error('[BANNER] createBanner error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function updateBanner(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Banner not found' });
      return;
    }

    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: parsed.data as any,
    });
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error('[BANNER] updateBanner error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function deleteBanner(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Banner not found' });
      return;
    }

    await prisma.banner.delete({ where: { id: req.params.id } });
    res.json({ success: true, data: { id: req.params.id } });
  } catch (err) {
    console.error('[BANNER] deleteBanner error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function reorderBanners(req: Request, res: Response): Promise<void> {
  try {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    await prisma.$transaction(
      parsed.data.map(({ id, sortOrder }) =>
        prisma.banner.update({ where: { id }, data: { sortOrder } })
      )
    );

    res.json({ success: true, data: { updated: parsed.data.length } });
  } catch (err) {
    console.error('[BANNER] reorderBanners error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function toggleActive(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.banner.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Banner not found' });
      return;
    }

    const banner = await prisma.banner.update({
      where: { id: req.params.id },
      data: { isActive: !existing.isActive },
    });
    res.json({ success: true, data: banner });
  } catch (err) {
    console.error('[BANNER] toggleActive error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
