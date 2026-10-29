import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { clearPublicReadCache } from '../middleware/publicReadCache';

const includeRelated = {
  related: { select: { id: true, name: true, slug: true, image: true, isActive: true, showOnWebsite: true } },
} as const;

export async function listRelated(req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.relatedProduct.findMany({
      where: { productId: req.params.productId },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      include: includeRelated,
    });
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('listRelated error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch related products' });
  }
}

export async function createRelated(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const relatedProductId = String(req.body?.relatedProductId ?? '');
    if (!relatedProductId) {
      res.status(400).json({ success: false, error: 'relatedProductId is required' });
      return;
    }
    if (relatedProductId === productId) {
      res.status(400).json({ success: false, error: 'A product cannot be related to itself' });
      return;
    }
    const related = await prisma.product.findUnique({ where: { id: relatedProductId }, select: { id: true } });
    if (!related) {
      res.status(404).json({ success: false, error: 'Related product not found' });
      return;
    }
    const row = await prisma.relatedProduct.create({
      data: {
        productId,
        relatedProductId,
        sortOrder: Number(req.body?.sortOrder) || 0,
      },
      include: includeRelated,
    });
    clearPublicReadCache();
    res.status(201).json({ success: true, data: row });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      res.status(400).json({ success: false, error: 'That product is already related' });
      return;
    }
    console.error('createRelated error:', error);
    res.status(500).json({ success: false, error: 'Failed to add related product' });
  }
}

export async function updateRelated(req: Request, res: Response): Promise<void> {
  try {
    const { productId, relatedId } = req.params;
    const existing = await prisma.relatedProduct.findFirst({ where: { id: relatedId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Related product not found' });
      return;
    }
    const row = await prisma.relatedProduct.update({
      where: { id: relatedId },
      data: { sortOrder: Number(req.body?.sortOrder) || 0 },
      include: includeRelated,
    });
    clearPublicReadCache();
    res.json({ success: true, data: row });
  } catch (error) {
    console.error('updateRelated error:', error);
    res.status(500).json({ success: false, error: 'Failed to update related product' });
  }
}

export async function deleteRelated(req: Request, res: Response): Promise<void> {
  try {
    const { productId, relatedId } = req.params;
    const existing = await prisma.relatedProduct.findFirst({ where: { id: relatedId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Related product not found' });
      return;
    }
    await prisma.relatedProduct.delete({ where: { id: relatedId } });
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error) {
    console.error('deleteRelated error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete related product' });
  }
}
