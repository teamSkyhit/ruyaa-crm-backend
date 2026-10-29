import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { clearPublicReadCache } from '../middleware/publicReadCache';

const packInclude = {
  product: { select: { id: true, name: true, slug: true } },
} as const;

function money(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : NaN;
}

async function productOrNull(productId: unknown): Promise<{ id: string } | null | false> {
  if (productId === null || productId === undefined || productId === '') return null;
  if (typeof productId !== 'string') return false;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return product ?? false;
}

export async function listPackCards(_req: Request, res: Response): Promise<void> {
  try {
    const packs = await prisma.packCard.findMany({
      include: packInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: packs });
  } catch (error) {
    console.error('listPackCards error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pack cards' });
  }
}

export async function createPackCard(req: Request, res: Response): Promise<void> {
  try {
    const { title, subtitle, badge, image, price, compareAtPrice, sortOrder, isActive, productId } = req.body;
    if (!title || !String(title).trim()) {
      res.status(400).json({ success: false, error: 'title is required' });
      return;
    }
    const amount = money(price);
    const compare = money(compareAtPrice);
    if (amount === null || Number.isNaN(amount)) {
      res.status(400).json({ success: false, error: 'price is required' });
      return;
    }
    if (Number.isNaN(compare)) {
      res.status(400).json({ success: false, error: 'compareAtPrice must be a number' });
      return;
    }
    const product = await productOrNull(productId);
    if (product === false) {
      res.status(400).json({ success: false, error: 'Product not found' });
      return;
    }
    const pack = await prisma.packCard.create({
      data: {
        title: String(title).trim(),
        subtitle: subtitle ? String(subtitle).trim() : null,
        badge: badge ? String(badge).trim() : null,
        image: image ? String(image).trim() : null,
        price: amount,
        compareAtPrice: compare,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
        productId: product?.id ?? null,
      },
      include: packInclude,
    });
    clearPublicReadCache();
    res.status(201).json({ success: true, data: pack });
  } catch (error) {
    console.error('createPackCard error:', error);
    res.status(500).json({ success: false, error: 'Failed to create pack card' });
  }
}

export async function updatePackCard(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const existing = await prisma.packCard.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Pack card not found' });
      return;
    }
    const { title, subtitle, badge, image, price, compareAtPrice, sortOrder, isActive, productId } = req.body;
    const amount = price === undefined ? undefined : money(price);
    const compare = compareAtPrice === undefined ? undefined : money(compareAtPrice);
    if (amount !== undefined && (amount === null || Number.isNaN(amount))) {
      res.status(400).json({ success: false, error: 'price must be a number' });
      return;
    }
    if (compare !== undefined && Number.isNaN(compare)) {
      res.status(400).json({ success: false, error: 'compareAtPrice must be a number' });
      return;
    }
    let nextProductId: string | null | undefined;
    if (productId !== undefined) {
      const product = await productOrNull(productId);
      if (product === false) {
        res.status(400).json({ success: false, error: 'Product not found' });
        return;
      }
      nextProductId = product?.id ?? null;
    }
    const pack = await prisma.packCard.update({
      where: { id },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(subtitle !== undefined && { subtitle: subtitle ? String(subtitle).trim() : null }),
        ...(badge !== undefined && { badge: badge ? String(badge).trim() : null }),
        ...(image !== undefined && { image: image ? String(image).trim() : null }),
        ...(amount !== undefined && { price: amount }),
        ...(compare !== undefined && { compareAtPrice: compare }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
        ...(nextProductId !== undefined && { productId: nextProductId }),
      },
      include: packInclude,
    });
    clearPublicReadCache();
    res.json({ success: true, data: pack });
  } catch (error) {
    console.error('updatePackCard error:', error);
    res.status(500).json({ success: false, error: 'Failed to update pack card' });
  }
}

export async function deletePackCard(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.packCard.delete({ where: { id } });
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Pack card not found' });
      return;
    }
    console.error('deletePackCard error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete pack card' });
  }
}
