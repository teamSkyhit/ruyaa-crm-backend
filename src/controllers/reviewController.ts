import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ReviewStatus } from '@prisma/client';

export async function listReviews(req: Request, res: Response): Promise<void> {
  try {
    const { status, productId, page = '1', limit = '20' } = req.query;
    const take = Math.min(Number(limit) || 20, 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};
    if (status && Object.values(ReviewStatus).includes(status as ReviewStatus)) {
      where.status = status as ReviewStatus;
    }
    if (productId) where.productId = productId;

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: { product: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.review.count({ where }),
    ]);

    res.json({
      success: true,
      data: { reviews, pagination: { total, page: Number(page), limit: take, pages: Math.ceil(total / take) } },
    });
  } catch (error) {
    console.error('[listReviews]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
}

export async function updateReviewStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !Object.values(ReviewStatus).includes(status as ReviewStatus)) {
      res.status(400).json({ success: false, error: 'Invalid status' });
      return;
    }

    const review = await prisma.review.update({
      where: { id },
      data: { status: status as ReviewStatus },
    });
    res.json({ success: true, data: review });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'Review not found' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update review status' });
  }
}

export async function deleteReview(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.review.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ success: false, error: 'Review not found' }); return; }
    res.status(500).json({ success: false, error: 'Failed to delete review' });
  }
}

// Public: submit a review
export async function submitReview(req: Request, res: Response): Promise<void> {
  try {
    const { productId, orderId, customerName, customerEmail, rating, title, comment } = req.body as {
      productId?: string;
      orderId?: string;
      customerName?: string;
      customerEmail?: string;
      rating?: number;
      title?: string;
      comment?: string;
    };

    if (!productId || !customerName || !customerEmail || !rating) {
      res.status(400).json({ success: false, error: 'productId, customerName, customerEmail, and rating are required' });
      return;
    }

    if (rating < 1 || rating > 5) {
      res.status(400).json({ success: false, error: 'rating must be between 1 and 5' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const review = await prisma.review.create({
      data: {
        productId,
        orderId: orderId ?? null,
        customerName,
        customerEmail,
        rating,
        title: title ?? null,
        comment: comment ?? null,
        status: ReviewStatus.PENDING,
      },
    });

    res.status(201).json({ success: true, data: { id: review.id, status: 'PENDING' } });
  } catch (error) {
    console.error('[submitReview]', error);
    res.status(500).json({ success: false, error: 'Failed to submit review' });
  }
}

// Public: get approved reviews for a product
export async function getProductReviews(req: Request, res: Response): Promise<void> {
  try {
    const { productSlug } = req.params;

    const product = await prisma.product.findFirst({
      where: { slug: productSlug, isActive: true },
      select: { id: true },
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const reviews = await prisma.review.findMany({
      where: { productId: product.id, status: ReviewStatus.APPROVED },
      select: { id: true, customerName: true, rating: true, title: true, comment: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const avgRating = reviews.length > 0
      ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
      : null;

    res.json({ success: true, data: { reviews, avgRating, total: reviews.length } });
  } catch (error) {
    console.error('[getProductReviews]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
}
