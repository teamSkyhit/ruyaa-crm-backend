import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { clearPublicReadCache } from '../middleware/publicReadCache';

export async function listHighlights(req: Request, res: Response): Promise<void> {
  try {
    const highlights = await prisma.productHighlight.findMany({
      where: { productId: req.params.productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: highlights });
  } catch (error) {
    console.error('listHighlights error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch highlights' });
  }
}

export async function createHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { title, description, image, imageAlt, sortOrder, isActive } = req.body ?? {};
    if (!title || !String(title).trim()) {
      res.status(400).json({ success: false, error: 'title is required' });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const highlight = await prisma.productHighlight.create({
      data: {
        productId,
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        image: image ? String(image).trim() : null,
        imageAlt: imageAlt ? String(imageAlt).trim() : null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
      },
    });
    clearPublicReadCache();
    res.status(201).json({ success: true, data: highlight });
  } catch (error) {
    console.error('createHighlight error:', error);
    res.status(500).json({ success: false, error: 'Failed to create highlight' });
  }
}

export async function updateHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { productId, highlightId } = req.params;
    const existing = await prisma.productHighlight.findFirst({ where: { id: highlightId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Highlight not found' });
      return;
    }
    const { title, description, image, imageAlt, sortOrder, isActive } = req.body ?? {};
    const highlight = await prisma.productHighlight.update({
      where: { id: highlightId },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: description ? String(description).trim() : null }),
        ...(image !== undefined && { image: image ? String(image).trim() : null }),
        ...(imageAlt !== undefined && { imageAlt: imageAlt ? String(imageAlt).trim() : null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    clearPublicReadCache();
    res.json({ success: true, data: highlight });
  } catch (error) {
    console.error('updateHighlight error:', error);
    res.status(500).json({ success: false, error: 'Failed to update highlight' });
  }
}

export async function deleteHighlight(req: Request, res: Response): Promise<void> {
  try {
    const { productId, highlightId } = req.params;
    const existing = await prisma.productHighlight.findFirst({ where: { id: highlightId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Highlight not found' });
      return;
    }
    await prisma.productHighlight.delete({ where: { id: highlightId } });
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error) {
    console.error('deleteHighlight error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete highlight' });
  }
}
