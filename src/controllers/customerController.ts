import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { ApiResponse, PaginationMeta } from '../types';

export const listCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page = '1', limit = '20', search } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.CustomerWhereInput = {};
    if (search) {
      const s = String(search).trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const customerIds = customers.map((c) => c.id);
    const orderAggregates = await prisma.order.groupBy({
      by: ['customerId'],
      where: { customerId: { in: customerIds } },
      _sum: { total: true },
    });
    const totalSpentMap = new Map(
      orderAggregates.map((a) => [a.customerId, Number(a._sum.total ?? 0)])
    );

    const data = customers.map((c) => ({
      ...c,
      orderCount: c._count.orders,
      totalSpent: totalSpentMap.get(c.id) ?? 0,
    }));

    const meta: PaginationMeta = {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };

    res.json({ success: true, data, meta } as ApiResponse);
  } catch (error) {
    console.error('[listCustomers]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customers' } as ApiResponse);
  }
};

export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
        },
        orders: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            paymentStatus: true,
            paymentMethod: true,
            total: true,
            createdAt: true,
          },
        },
      },
    });

    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: customer } as ApiResponse);
  } catch (error) {
    console.error('[getCustomer]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch customer' } as ApiResponse);
  }
};

export const updateCustomerNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      res.status(404).json({ success: false, error: 'Customer not found' } as ApiResponse);
      return;
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: { notes: typeof notes === 'string' ? notes : null },
    });

    res.json({ success: true, data: updated } as ApiResponse);
  } catch (error) {
    console.error('[updateCustomerNotes]', error);
    res.status(500).json({ success: false, error: 'Failed to update customer notes' } as ApiResponse);
  }
};
