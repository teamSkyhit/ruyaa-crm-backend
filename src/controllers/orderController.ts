import { Request, Response } from 'express';
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { ApiResponse, PaginationMeta } from '../types';
import { sendShippingUpdate, sendDeliveryConfirmation, sendReviewRequest } from '../services/resendService';
import { applyCourierUpdate, bookShipment, getTracking, isShiprocketConfigured, scheduleShipment } from '../services/shiprocketService';
import * as whatsappService from '../services/whatsappService';

const ALLOWED_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  PROCESSING: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  SHIPPED: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
};

function stripSignature<T extends Record<string, unknown>>(order: T): Omit<T, 'razorpaySignature'> {
  const { razorpaySignature: _sig, ...safe } = order as any;
  return safe;
}

export const listOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '20',
      status,
      paymentMethod,
      paymentStatus,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const where: Prisma.OrderWhereInput = {};

    if (status && Object.values(OrderStatus).includes(status as OrderStatus)) {
      where.status = status as OrderStatus;
    }
    if (paymentMethod && Object.values(PaymentMethod).includes(paymentMethod as PaymentMethod)) {
      where.paymentMethod = paymentMethod as PaymentMethod;
    }
    if (paymentStatus && Object.values(PaymentStatus).includes(paymentStatus as PaymentStatus)) {
      where.paymentStatus = paymentStatus as PaymentStatus;
    }
    if (startDate || endDate) {
      where.createdAt = {
        ...(startDate ? { gte: new Date(String(startDate)) } : {}),
        ...(endDate ? { lte: new Date(String(endDate)) } : {}),
      };
    }
    if (search) {
      const s = String(search).trim();
      where.OR = [
        { orderNumber: { contains: s, mode: 'insensitive' } },
        { customerEmail: { contains: s, mode: 'insensitive' } },
        { customerPhone: { contains: s } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentMethod: true,
          paymentStatus: true,
          subtotal: true,
          discount: true,
          shippingCharge: true,
          total: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          customerId: true,
          confirmedAt: true,
          shippedAt: true,
          deliveredAt: true,
          cancelledAt: true,
          trackingNumber: true,
          createdAt: true,
          updatedAt: true,
          customer: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const meta: PaginationMeta = {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };

    res.json({ success: true, data: orders, meta } as ApiResponse);
  } catch (error) {
    console.error('[listOrders]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch orders' } as ApiResponse);
  }
};

export const getOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        customer: {
          select: { id: true, name: true, email: true, phone: true, notes: true },
        },
        cancelledBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse);
      return;
    }

    res.json({ success: true, data: stripSignature(order as any) } as ApiResponse);
  } catch (error) {
    console.error('[getOrder]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch order' } as ApiResponse);
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status: newStatus } = req.body;

    if (!newStatus || !Object.values(OrderStatus).includes(newStatus as OrderStatus)) {
      res.status(400).json({ success: false, error: 'Invalid status value' } as ApiResponse);
      return;
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse);
      return;
    }

    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(newStatus as OrderStatus)) {
      res.status(400).json({
        success: false,
        error: `Transition from ${order.status} to ${newStatus} is not allowed`,
      } as ApiResponse);
      return;
    }

    const now = new Date();
    const data: Prisma.OrderUpdateInput = { status: newStatus as OrderStatus };
    if (newStatus === OrderStatus.CONFIRMED) data.confirmedAt = now;
    if (newStatus === OrderStatus.SHIPPED) data.shippedAt = now;
    if (newStatus === OrderStatus.DELIVERED) data.deliveredAt = now;
    if (newStatus === OrderStatus.CANCELLED) data.cancelledAt = now;

    const updated = await prisma.order.update({ where: { id }, data });

    if (newStatus === OrderStatus.PROCESSING) {
      scheduleShipment(updated.id);
    }

    if (newStatus === OrderStatus.CONFIRMED) {
      whatsappService.sendOrderConfirmed(
        updated.customerPhone,
        updated.orderNumber,
        Number(updated.total).toFixed(2)
      );
    }

    if (newStatus === OrderStatus.SHIPPED) {
      sendShippingUpdate({
        orderNumber: updated.orderNumber,
        customerEmail: updated.customerEmail,
        customerName: updated.customerName,
        trackingNumber: updated.trackingNumber,
        trackingUrl: updated.trackingUrl,
      }).catch((err) => console.error('[sendShippingUpdate after status update]', err));
      whatsappService.sendOrderShipped(
        updated.customerPhone,
        updated.orderNumber,
        updated.trackingNumber ?? '',
        updated.courierName ?? ''
      );
    }

    if (newStatus === OrderStatus.DELIVERED) {
      sendDeliveryConfirmation({
        orderNumber: updated.orderNumber,
        customerEmail: updated.customerEmail,
        customerName: updated.customerName,
      }).catch((err) => console.error('[sendDeliveryConfirmation]', err));
      whatsappService.sendOrderDelivered(updated.customerPhone, updated.orderNumber);
    }

    res.json({ success: true, data: stripSignature(updated as any) } as ApiResponse);
  } catch (error) {
    console.error('[updateOrderStatus]', error);
    res.status(500).json({ success: false, error: 'Failed to update order status' } as ApiResponse);
  }
};

export const addTracking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { trackingNumber, trackingUrl } = req.body;

    if (!trackingNumber || !String(trackingNumber).trim()) {
      res.status(400).json({ success: false, error: 'trackingNumber is required' } as ApiResponse);
      return;
    }

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse);
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: {
        trackingNumber: String(trackingNumber).trim(),
        ...(trackingUrl ? { trackingUrl: String(trackingUrl).trim() } : {}),
      },
    });

    if (order.status === OrderStatus.SHIPPED) {
      sendShippingUpdate({
        orderNumber: updated.orderNumber,
        customerEmail: updated.customerEmail,
        customerName: updated.customerName,
        trackingNumber: updated.trackingNumber,
        trackingUrl: updated.trackingUrl,
      }).catch((err) => console.error('[sendShippingUpdate after addTracking]', err));
    }

    res.json({ success: true, data: stripSignature(updated as any) } as ApiResponse);
  } catch (error) {
    console.error('[addTracking]', error);
    res.status(500).json({ success: false, error: 'Failed to update tracking' } as ApiResponse);
  }
};

export const updateAdminNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse);
      return;
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { adminNotes: typeof adminNotes === 'string' ? adminNotes : null },
    });

    res.json({ success: true, data: stripSignature(updated as any) } as ApiResponse);
  } catch (error) {
    console.error('[updateAdminNotes]', error);
    res.status(500).json({ success: false, error: 'Failed to update admin notes' } as ApiResponse);
  }
};

export const cancelOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { cancellationReason } = req.body;
    const cancelledById = req.user!.userId;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { select: { productId: true, quantity: true } },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse);
      return;
    }

    const terminal: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.DELIVERED, OrderStatus.REFUNDED];
    if (terminal.includes(order.status)) {
      res.status(400).json({
        success: false,
        error: `Order cannot be cancelled (current status: ${order.status})`,
      } as ApiResponse);
      return;
    }

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.productId) continue;
        // Atomic stock restore — always safe to add back
        await tx.$executeRaw`
          UPDATE products
          SET quantity = quantity + ${item.quantity}
          WHERE id = ${item.productId}::uuid
        `;
      }

      return tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledById,
          cancellationReason: typeof cancellationReason === 'string' ? cancellationReason : null,
        },
      });
    });

    res.json({ success: true, data: stripSignature(updated as any) } as ApiResponse);
  } catch (error) {
    console.error('[cancelOrder]', error);
    res.status(500).json({ success: false, error: 'Failed to cancel order' } as ApiResponse);
  }
};

export const sendOrderReviewRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { select: { productName: true, productSlug: true } } },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (order.status !== OrderStatus.DELIVERED) {
      res.status(400).json({ success: false, error: 'Review request can only be sent for delivered orders' });
      return;
    }

    const storefrontUrl = process.env.STOREFRONT_URL || 'https://ruyaaessentials.com';

    await sendReviewRequest(
      { orderNumber: order.orderNumber, customerEmail: order.customerEmail, customerName: order.customerName },
      order.items,
      storefrontUrl
    );

    await prisma.order.update({ where: { id }, data: { reviewRequestSentAt: new Date() } });

    res.json({ success: true, message: 'Review request sent' });
  } catch (error) {
    console.error('[sendOrderReviewRequest]', error);
    res.status(500).json({ success: false, error: 'Failed to send review request' });
  }
};

export async function computeOrderStats(): Promise<{
  totalOrders: number;
  revenue: number;
  ordersByStatus: Record<string, number>;
}> {
  const [statusGroups, revenueAgg, totalOrders] = await Promise.all([
    prisma.order.groupBy({
      by: ['status'],
      _count: { status: true },
    }),
    prisma.order.aggregate({
      where: {
        status: {
          in: [
            OrderStatus.CONFIRMED,
            OrderStatus.PROCESSING,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        },
        paymentStatus: PaymentStatus.PAID,
      },
      _sum: { total: true },
    }),
    prisma.order.count(),
  ]);

  const ordersByStatus: Record<string, number> = {};
  for (const g of statusGroups) {
    ordersByStatus[g.status] = g._count.status;
  }

  return {
    totalOrders,
    revenue: Number(revenueAgg._sum.total ?? 0),
    ordersByStatus,
  };
}

export async function bookOrderShipment(req: Request, res: Response): Promise<void> {
  try {
    const result = await bookShipment(req.params.id);
    if (!result.booked) {
      const status = result.reason === 'Order not found' ? 404 : result.reason === 'Shiprocket is not configured' ? 503 : 400;
      res.status(status).json({ success: false, error: result.reason });
      return;
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    res.json({ success: true, data: order });
  } catch (error) {
    console.error('[bookOrderShipment]', error);
    res.status(500).json({ success: false, error: 'Failed to book the shipment' });
  }
}

export async function refreshOrderTracking(req: Request, res: Response): Promise<void> {
  try {
    if (!(await isShiprocketConfigured())) {
      res.status(503).json({ success: false, error: 'Shiprocket is not configured' });
      return;
    }
    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    if (!order.trackingNumber) {
      res.status(400).json({ success: false, error: 'This order has no tracking number' });
      return;
    }
    const tracking = await getTracking(order.trackingNumber);
    await applyCourierUpdate({
      orderNumber: order.orderNumber,
      awb: order.trackingNumber,
      status: tracking.status,
      courierName: order.courierName || undefined,
    });
    const updated = await prisma.order.findUnique({ where: { id: order.id } });
    res.json({ success: true, data: updated, activities: tracking.activities });
  } catch (error) {
    console.error('[refreshOrderTracking]', error);
    res.status(502).json({ success: false, error: 'Shiprocket tracking could not be read' });
  }
}

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await computeOrderStats();
    res.json({ success: true, data: stats } as ApiResponse);
  } catch (error) {
    console.error('[getDashboardStats]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' } as ApiResponse);
  }
};
