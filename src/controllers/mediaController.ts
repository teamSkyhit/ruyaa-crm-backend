import { Request, Response } from 'express';
import { MediaKind } from '@prisma/client';
import prisma from '../prismaClient';
import { clearPublicReadCache } from '../middleware/publicReadCache';

const mediaSelect = {
  id: true,
  productId: true,
  variantId: true,
  kind: true,
  url: true,
  thumbnailUrl: true,
  altText: true,
  sortOrder: true,
  isActive: true,
} as const;

async function syncProductImages(productId: string): Promise<void> {
  const images = await prisma.productMedia.findMany({
    where: { productId, variantId: null, kind: MediaKind.IMAGE, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { url: true },
  });
  const urls = images.map((item) => item.url);
  await prisma.product.update({
    where: { id: productId },
    data: { image: urls[0] ?? null, images: urls },
  });
}

async function backfillLegacyPictures(productId: string): Promise<void> {
  const existing = await prisma.productMedia.count({
    where: { productId, variantId: null, kind: MediaKind.IMAGE },
  });
  if (existing > 0) return;
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { image: true, images: true },
  });
  const urls = (product?.images?.length ? product.images : product?.image ? [product.image] : []).filter(Boolean);
  if (!urls.length) return;
  await prisma.productMedia.createMany({
    data: urls.map((url, index) => ({
      productId,
      kind: MediaKind.IMAGE,
      url,
      sortOrder: index,
    })),
  });
}

export async function listMedia(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    await backfillLegacyPictures(productId);
    const variantId = typeof req.query.variantId === 'string' ? req.query.variantId : undefined;
    const media = await prisma.productMedia.findMany({
      where: {
        productId,
        ...(variantId === 'product' ? { variantId: null } : {}),
        ...(variantId && variantId !== 'product' ? { variantId } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      select: mediaSelect,
    });
    res.json({ success: true, data: media });
  } catch (error) {
    console.error('listMedia error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch media' });
  }
}

export async function createMedia(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { variantId, kind, url, thumbnailUrl, altText, sortOrder, isActive } = req.body ?? {};
    if (!url || (kind !== 'IMAGE' && kind !== 'VIDEO')) {
      res.status(400).json({ success: false, error: 'url and kind (IMAGE or VIDEO) are required' });
      return;
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    if (variantId) {
      const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId }, select: { id: true } });
      if (!variant) {
        res.status(400).json({ success: false, error: 'Variant not found on this product' });
        return;
      }
    }
    const media = await prisma.productMedia.create({
      data: {
        productId,
        variantId: variantId || null,
        kind: kind as MediaKind,
        url: String(url).trim(),
        thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : null,
        altText: altText ? String(altText).trim() : null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
      },
      select: mediaSelect,
    });
    if (!media.variantId && media.kind === 'IMAGE') await syncProductImages(productId);
    clearPublicReadCache();
    res.status(201).json({ success: true, data: media });
  } catch (error) {
    console.error('createMedia error:', error);
    res.status(500).json({ success: false, error: 'Failed to create media' });
  }
}

export async function updateMedia(req: Request, res: Response): Promise<void> {
  try {
    const { productId, mediaId } = req.params;
    const existing = await prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Media not found' });
      return;
    }
    const { url, thumbnailUrl, altText, sortOrder, isActive } = req.body ?? {};
    const media = await prisma.productMedia.update({
      where: { id: mediaId },
      data: {
        ...(url !== undefined && { url: String(url).trim() }),
        ...(thumbnailUrl !== undefined && { thumbnailUrl: thumbnailUrl ? String(thumbnailUrl).trim() : null }),
        ...(altText !== undefined && { altText: altText ? String(altText).trim() : null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
      select: mediaSelect,
    });
    if (!existing.variantId) await syncProductImages(productId);
    clearPublicReadCache();
    res.json({ success: true, data: media });
  } catch (error) {
    console.error('updateMedia error:', error);
    res.status(500).json({ success: false, error: 'Failed to update media' });
  }
}

export async function deleteMedia(req: Request, res: Response): Promise<void> {
  try {
    const { productId, mediaId } = req.params;
    const existing = await prisma.productMedia.findFirst({ where: { id: mediaId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Media not found' });
      return;
    }
    await prisma.productMedia.delete({ where: { id: mediaId } });
    if (!existing.variantId) await syncProductImages(productId);
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error) {
    console.error('deleteMedia error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete media' });
  }
}
