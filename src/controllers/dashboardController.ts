import { Request, Response } from 'express';
import prisma from '../prismaClient';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateLabel(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const today = startOfToday();
    const weekStart = startOfWeek();
    const monthStart = startOfMonth();
    const thirtyDaysAgo = daysAgo(30);

    // Daily revenue for last 30 days via raw SQL (group by day in local timezone)
    const dailyRevenueRaw = await prisma.$queryRaw<{ day: Date; revenue: number }[]>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, SUM(total) AS revenue
      FROM orders
      WHERE "paymentStatus" = 'PAID' AND "createdAt" >= ${thirtyDaysAgo}
      GROUP BY day
      ORDER BY day ASC
    `;

    const dailyRevenueMap = new Map<string, number>();
    for (const row of dailyRevenueRaw) {
      dailyRevenueMap.set(dateLabel(new Date(row.day)), Number(row.revenue));
    }

    // Fill all 30 days including zeros
    const dailyRevenue: { date: string; revenue: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const key = dateLabel(d);
      dailyRevenue.push({ date: key, revenue: dailyRevenueMap.get(key) ?? 0 });
    }

    const [
      revToday,
      revWeek,
      revMonth,
      revAllTime,
      ordersByStatus,
      ordersToday,
      ordersThisWeek,
      totalActiveProducts,
      recentOrders,
      topProducts,
    ] = await Promise.all([
      // Revenue aggregates — only PAID orders
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: today } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: weekStart } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID', createdAt: { gte: monthStart } },
      }),
      prisma.order.aggregate({
        _sum: { total: true },
        where: { paymentStatus: 'PAID' },
      }),

      // Order counts by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Order counts by period
      prisma.order.count({ where: { createdAt: { gte: today } } }),
      prisma.order.count({ where: { createdAt: { gte: weekStart } } }),

      // Product stats
      prisma.product.count({ where: { isActive: true } }),

      // Recent orders
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          customerName: true,
          createdAt: true,
          paymentStatus: true,
          paymentMethod: true,
        },
      }),

      // Top products by quantity sold in last 30 days (PAID orders only)
      prisma.orderItem.groupBy({
        by: ['productId', 'productName'],
        _sum: { quantity: true },
        where: {
          order: { createdAt: { gte: thirtyDaysAgo }, paymentStatus: 'PAID' },
          productId: { not: null },
        },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    // Column-to-column comparison (quantity <= lowStockThreshold) requires raw SQL
    const lowStock = await prisma.$queryRaw<
      { id: string; name: string; sku: string; quantity: number; lowStockThreshold: number }[]
    >`
      SELECT id, name, sku, quantity, "lowStockThreshold"
      FROM products
      WHERE "isActive" = true AND quantity <= "lowStockThreshold"
      ORDER BY quantity ASC
    `;

    const statusMap: Record<string, number> = {};
    for (const row of ordersByStatus) {
      statusMap[row.status] = row._count._all;
    }

    res.json({
      success: true,
      data: {
        revenue: {
          today: Number(revToday._sum.total ?? 0),
          thisWeek: Number(revWeek._sum.total ?? 0),
          thisMonth: Number(revMonth._sum.total ?? 0),
          allTime: Number(revAllTime._sum.total ?? 0),
        },
        orders: {
          byStatus: statusMap,
          today: ordersToday,
          thisWeek: ordersThisWeek,
        },
        products: {
          totalActive: totalActiveProducts,
          lowStock,
        },
        recentOrders,
        topProducts: topProducts.map((p) => ({
          productId: p.productId,
          productName: p.productName,
          totalQuantity: p._sum.quantity ?? 0,
        })),
        dailyRevenue,
      },
    });
  } catch (err) {
    console.error('[DASHBOARD] getStats error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
