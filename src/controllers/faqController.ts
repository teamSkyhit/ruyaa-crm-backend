import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { clearPublicReadCache } from '../middleware/publicReadCache';

const prisma = new PrismaClient();

const faqInclude = {
  product: { select: { id: true, name: true, slug: true } },
} as const;

async function resolveProductId(productId: unknown): Promise<string | null | false> {
  if (productId === null || productId === undefined || productId === '') return null;
  if (typeof productId !== 'string') return false;
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  return product ? product.id : false;
}

export async function listFaqs(_req: Request, res: Response): Promise<void> {
  try {
    const faqs = await prisma.faq.findMany({
      include: faqInclude,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ faqs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FAQs' });
  }
}

export async function createFaq(req: Request, res: Response): Promise<void> {
  try {
    const { question, answer, category, sortOrder, isActive, productId } = req.body;
    if (!question || !answer) {
      res.status(400).json({ error: 'question and answer are required' });
      return;
    }
    const resolvedProductId = await resolveProductId(productId);
    if (resolvedProductId === false) {
      res.status(400).json({ error: 'Product not found' });
      return;
    }
    const faq = await prisma.faq.create({
      data: {
        question,
        answer,
        category: category || null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        productId: resolvedProductId,
      },
      include: faqInclude,
    });
    clearPublicReadCache();
    res.status(201).json({ faq });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create FAQ' });
  }
}

export async function updateFaq(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { question, answer, category, sortOrder, isActive, productId } = req.body;
    let resolvedProductId: string | null | undefined;
    if (productId !== undefined) {
      const resolved = await resolveProductId(productId);
      if (resolved === false) {
        res.status(400).json({ error: 'Product not found' });
        return;
      }
      resolvedProductId = resolved;
    }
    const faq = await prisma.faq.update({
      where: { id },
      data: {
        ...(question !== undefined && { question }),
        ...(answer !== undefined && { answer }),
        ...(category !== undefined && { category }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
        ...(resolvedProductId !== undefined && { productId: resolvedProductId }),
      },
      include: faqInclude,
    });
    clearPublicReadCache();
    res.json({ faq });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'FAQ not found' }); return; }
    res.status(500).json({ error: 'Failed to update FAQ' });
  }
}

export async function deleteFaq(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.faq.delete({ where: { id } });
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'FAQ not found' }); return; }
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
}

export async function reorderFaqs(req: Request, res: Response): Promise<void> {
  try {
    const { items } = req.body as { items: { id: string; sortOrder: number }[] };
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'items must be an array' });
      return;
    }
    await prisma.$transaction(
      items.map(({ id, sortOrder }) =>
        prisma.faq.update({ where: { id }, data: { sortOrder } })
      )
    );
    clearPublicReadCache();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to reorder FAQs' });
  }
}
