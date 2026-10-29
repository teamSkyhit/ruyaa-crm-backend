import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { clearPublicReadCache } from '../middleware/publicReadCache';

async function productExists(productId: string): Promise<boolean> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return Boolean(product);
}

export async function listBenefits(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    if (!(await productExists(productId))) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const benefits = await prisma.productBenefit.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: benefits });
  } catch (error) {
    console.error('listBenefits error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch benefits' });
  }
}

export async function createBenefit(req: Request, res: Response): Promise<void> {
  try {
    const { productId } = req.params;
    const { title, description, image, imageAlt, sortOrder, isActive } = req.body;
    if (!title || !String(description ?? '').trim()) {
      res.status(400).json({ success: false, error: 'title and description are required' });
      return;
    }
    if (!(await productExists(productId))) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const benefit = await prisma.productBenefit.create({
      data: {
        productId,
        title: String(title).trim(),
        description: String(description).trim(),
        image: image ? String(image).trim() : null,
        imageAlt: imageAlt ? String(imageAlt).trim() : null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false,
      },
    });
    clearPublicReadCache();
    res.status(201).json({ success: true, data: benefit });
  } catch (error) {
    console.error('createBenefit error:', error);
    res.status(500).json({ success: false, error: 'Failed to create benefit' });
  }
}

export async function updateBenefit(req: Request, res: Response): Promise<void> {
  try {
    const { productId, benefitId } = req.params;
    const existing = await prisma.productBenefit.findFirst({ where: { id: benefitId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Benefit not found' });
      return;
    }
    const { title, description, image, imageAlt, sortOrder, isActive } = req.body;
    const benefit = await prisma.productBenefit.update({
      where: { id: benefitId },
      data: {
        ...(title !== undefined && { title: String(title).trim() }),
        ...(description !== undefined && { description: String(description).trim() }),
        ...(image !== undefined && { image: image ? String(image).trim() : null }),
        ...(imageAlt !== undefined && { imageAlt: imageAlt ? String(imageAlt).trim() : null }),
        ...(sortOrder !== undefined && { sortOrder: Number(sortOrder) || 0 }),
        ...(isActive !== undefined && { isActive: Boolean(isActive) }),
      },
    });
    clearPublicReadCache();
    res.json({ success: true, data: benefit });
  } catch (error) {
    console.error('updateBenefit error:', error);
    res.status(500).json({ success: false, error: 'Failed to update benefit' });
  }
}

export async function deleteBenefit(req: Request, res: Response): Promise<void> {
  try {
    const { productId, benefitId } = req.params;
    const existing = await prisma.productBenefit.findFirst({ where: { id: benefitId, productId } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Benefit not found' });
      return;
    }
    await prisma.productBenefit.delete({ where: { id: benefitId } });
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error) {
    console.error('deleteBenefit error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete benefit' });
  }
}
