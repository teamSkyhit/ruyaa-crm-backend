import { Request, Response } from 'express';
import prisma from '../prismaClient';

function readVariant(body: Record<string, unknown>, partial: boolean) {
  const data: Record<string, unknown> = {};
  if (!partial || body.name !== undefined) {
    const name = String(body.name ?? '').trim();
    if (!name) return { error: 'name is required' };
    data.name = name;
  }
  if (!partial || body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return { error: 'price is required' };
    data.price = price;
  }
  if (body.sku !== undefined) data.sku = body.sku ? String(body.sku).trim() : null;
  if (body.compareAtPrice !== undefined) {
    data.compareAtPrice = body.compareAtPrice === null || body.compareAtPrice === ''
      ? null
      : Number(body.compareAtPrice);
  }
  if (body.quantity !== undefined) data.quantity = Math.max(0, Number(body.quantity) || 0);
  if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
  if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) || 0;
  return { data };
}

export async function listVariants(req: Request, res: Response): Promise<void> {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    const variants = await prisma.productVariant.findMany({
      where: { productId: product.id },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ variants });
  } catch (error) {
    console.error('[listVariants]', error);
    res.status(500).json({ error: 'Failed to fetch variants' });
  }
}

export async function createVariant(req: Request, res: Response): Promise<void> {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.productId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const parsed = readVariant(req.body ?? {}, false);
    if (parsed.error || !parsed.data) {
      res.status(400).json({ error: parsed.error || 'Invalid variant' });
      return;
    }

    const variant = await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: parsed.data.name as string,
        price: parsed.data.price as number,
        sku: (parsed.data.sku as string | null | undefined) ?? null,
        compareAtPrice: (parsed.data.compareAtPrice as number | null | undefined) ?? null,
        quantity: (parsed.data.quantity as number | undefined) ?? 0,
        isActive: (parsed.data.isActive as boolean | undefined) ?? true,
        sortOrder: (parsed.data.sortOrder as number | undefined) ?? 0,
      },
    });
    res.status(201).json({ variant });
  } catch (error) {
    console.error('[createVariant]', error);
    res.status(500).json({ error: 'Failed to create variant' });
  }
}

export async function updateVariant(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.productVariant.findFirst({
      where: { id: req.params.variantId, productId: req.params.productId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }

    const parsed = readVariant(req.body ?? {}, true);
    if (parsed.error || !parsed.data) {
      res.status(400).json({ error: parsed.error || 'Invalid variant' });
      return;
    }

    const variant = await prisma.productVariant.update({
      where: { id: existing.id },
      data: parsed.data,
    });
    res.json({ variant });
  } catch (error) {
    console.error('[updateVariant]', error);
    res.status(500).json({ error: 'Failed to update variant' });
  }
}

export async function deleteVariant(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.productVariant.findFirst({
      where: { id: req.params.variantId, productId: req.params.productId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }
    await prisma.productVariant.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (error) {
    console.error('[deleteVariant]', error);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
}
