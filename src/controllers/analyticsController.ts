import { Request, Response } from 'express';
import prisma from '../prismaClient';

// GET /api/analytics/summary
export async function getSummary(req: Request, res: Response): Promise<void> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [revenueResult, ordersToday, pendingOrders, avgResult] = await Promise.all([
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }, createdAt: { gte: startOfMonth } },
      _sum: { total: true }
    }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.count({ where: { status: 'PENDING_PAYMENT' } }),
    prisma.order.aggregate({
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } },
      _avg: { total: true }
    })
  ]);

  res.json({
    success: true,
    data: {
      revenueThisMonth: revenueResult._sum.total?.toString() || '0.00',
      ordersToday,
      pendingOrders,
      avgOrderValue: avgResult._avg.total?.toString() || '0.00',
    }
  });
}

// GET /api/analytics/revenue?period=7d|30d|12m
export async function getRevenue(req: Request, res: Response): Promise<void> {
  const period = (req.query.period as string) || '30d';
  const now = new Date();
  const labels: string[] = [];
  const values: number[] = [];

  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      const result = await prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { total: true }
      });
      labels.push(`${date.getDate()}/${date.getMonth() + 1}`);
      values.push(Number(result._sum.total || 0));
    }
  } else if (period === '12m') {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const result = await prisma.order.aggregate({
        where: {
          createdAt: { gte: start, lt: end },
          status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
        },
        _sum: { total: true }
      });
      labels.push(months[d.getMonth()]);
      values.push(Number(result._sum.total || 0));
    }
  }

  res.json({ success: true, data: { labels, values } });
}

// GET /api/analytics/top-products?period=30d
export async function getTopProducts(req: Request, res: Response): Promise<void> {
  const period = (req.query.period as string) || '30d';
  const days = period === '7d' ? 7 : period === '12m' ? 365 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const items = await prisma.orderItem.groupBy({
    by: ['productId'],
    where: {
      productId: { not: null },
      order: {
        createdAt: { gte: since },
        status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] }
      }
    },
    _sum: { quantity: true, subtotal: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: 10,
  });

  const products = await Promise.all(items.map(async (item) => {
    const product = item.productId
      ? await prisma.product.findUnique({
          where: { id: item.productId },
          select: { name: true, slug: true }
        })
      : null;
    const sum = item._sum ?? {};
    return {
      productId: item.productId,
      name: product?.name ?? item.productId ?? 'Unknown',
      slug: product?.slug ?? '',
      unitsSold: sum.quantity ?? 0,
      revenue: Number(sum.subtotal ?? 0).toFixed(2),
    };
  }));

  res.json({ success: true, data: products });
}

// GET /api/analytics/orders-by-status
export async function getOrdersByStatus(req: Request, res: Response): Promise<void> {
  const statuses = ['PENDING_PAYMENT', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
  const counts = await Promise.all(
    statuses.map(async (status) => ({
      status,
      count: await prisma.order.count({ where: { status: status as any } })
    }))
  );
  res.json({ success: true, data: counts });
}
