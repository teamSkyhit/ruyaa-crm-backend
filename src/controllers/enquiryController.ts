import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { EnquiryStatus } from '@prisma/client';

const submitSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email: z.string().email().optional().or(z.literal('')),
  productId: z.string().uuid().optional(),
  message: z.string().min(1).max(1000).transform((s) => s.trim()),
  // Honeypot — bots fill this, humans don't
  website: z.string().max(0, 'Bot detected').optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['NEW', 'CONTACTED', 'CLOSED']),
});

const addNotesSchema = z.object({
  notes: z.string().max(2000),
});

const productSelect = { id: true, name: true, slug: true };

export async function submitEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const parsed = submitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const { name, phone, email, productId, message } = parsed.data;

    if (productId) {
      const product = await prisma.product.findFirst({
        where: { id: productId, showOnWebsite: true },
        select: { id: true },
      });
      if (!product) {
        res.status(400).json({ success: false, error: 'Invalid product' });
        return;
      }
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        phone,
        email: email || null,
        productId: productId || null,
        message,
        ipAddress: req.ip || null,
      },
      include: { product: { select: productSelect } },
    });

    res.status(201).json({
      success: true,
      data: { id: enquiry.id, message: 'Enquiry submitted successfully' },
    });
  } catch (err) {
    console.error('[ENQUIRY] submitEnquiry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function listEnquiries(req: Request, res: Response): Promise<void> {
  try {
    const { status, search, page = '1', limit = '20' } = req.query;
    const take = Math.min(Number(limit) || 20, 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: any = {};

    if (status && ['NEW', 'CONTACTED', 'CLOSED'].includes(String(status))) {
      where.status = String(status) as EnquiryStatus;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [enquiries, total] = await Promise.all([
      prisma.enquiry.findMany({
        where,
        include: { product: { select: productSelect } },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      prisma.enquiry.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        enquiries,
        pagination: {
          total,
          page: Number(page),
          limit: take,
          pages: Math.ceil(total / take),
        },
      },
    });
  } catch (err) {
    console.error('[ENQUIRY] listEnquiries error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Alias for backward compatibility
export { listEnquiries as getEnquiries };

export async function getEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const enquiry = await prisma.enquiry.findUnique({
      where: { id: req.params.id },
      include: { product: { select: productSelect } },
    });

    if (!enquiry) {
      res.status(404).json({ success: false, error: 'Enquiry not found' });
      return;
    }

    res.json({ success: true, data: enquiry });
  } catch (err) {
    console.error('[ENQUIRY] getEnquiry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Alias for backward compatibility
export { getEnquiry as getEnquiryById };

export async function updateStatus(req: Request, res: Response): Promise<void> {
  try {
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const existing = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Enquiry not found' });
      return;
    }

    const enquiry = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
      include: { product: { select: productSelect } },
    });

    res.json({ success: true, data: enquiry });
  } catch (err) {
    console.error('[ENQUIRY] updateStatus error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function addNotes(req: Request, res: Response): Promise<void> {
  try {
    const parsed = addNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const existing = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Enquiry not found' });
      return;
    }

    const enquiry = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: { notes: parsed.data.notes },
      include: { product: { select: productSelect } },
    });

    res.json({ success: true, data: enquiry });
  } catch (err) {
    console.error('[ENQUIRY] addNotes error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// Combined update (status + notes) — kept for backward compatibility
export async function updateEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const schema = z.object({
      status: z.enum(['NEW', 'CONTACTED', 'CLOSED']).optional(),
      notes: z.string().max(2000).optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: parsed.error.errors[0].message });
      return;
    }

    const existing = await prisma.enquiry.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ success: false, error: 'Enquiry not found' });
      return;
    }

    const enquiry = await prisma.enquiry.update({
      where: { id: req.params.id },
      data: parsed.data,
      include: { product: { select: productSelect } },
    });

    res.json({ success: true, data: enquiry });
  } catch (err) {
    console.error('[ENQUIRY] updateEnquiry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
