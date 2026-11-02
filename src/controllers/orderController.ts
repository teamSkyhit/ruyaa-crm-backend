import { Request, Response } from 'express';
import { Prisma, OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { ApiResponse, PaginationMeta } from '../types';
import { sendShippingUpdate, sendDeliveryConfirmation, sendReviewRequest } from '../services/resendService';
import { generateInvoicePdf } from '../services/invoiceService';
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
          channel: true,
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

export async function downloadInvoice(req: Request, res: Response): Promise<void> {
  try {
    const { buffer, orderNumber } = await generateInvoicePdf(req.params.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${orderNumber}.pdf"`);
    res.send(buffer);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate invoice';
    if (msg === 'Order not found') {
      res.status(404).json({ success: false, error: msg });
      return;
    }
    console.error('[downloadInvoice]', error);
    res.status(500).json({ success: false, error: 'Failed to generate invoice' });
  }
}

export async function sendInvoiceEmail(req: Request, res: Response): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: { include: { product: true, variant: true } } },
    });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }
    const { buffer } = await generateInvoicePdf(req.params.id);
    // Send via Resend with attachment
    const { apiKey, fromEmail } = await (async () => {
      const rows = await prisma.systemConfig.findMany({
        where: { key: { in: ['resend_api_key', 'from_email'] } },
      });
      const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      if (!map.resend_api_key || !map.from_email) {
        throw new Error('Resend credentials not configured');
      }
      return { apiKey: map.resend_api_key, fromEmail: map.from_email };
    })();

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from: fromEmail,
        to: order.customerEmail,
        subject: `Invoice for order ${order.orderNumber}`,
        html: `<p>Hi ${order.customerName},</p><p>Please find your invoice for order <strong>${order.orderNumber}</strong> attached.</p><p>Thank you for shopping with Ruyaa Essentials.</p>`,
        attachments: [
          {
            filename: `invoice-${order.orderNumber}.pdf`,
            content: buffer.toString('base64'),
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Resend error: ${errText}`);
    }

    res.json({ success: true, message: `Invoice sent to ${order.customerEmail}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to send invoice';
    if (msg === 'Order not found') {
      res.status(404).json({ success: false, error: msg });
      return;
    }
    console.error('[sendInvoiceEmail]', error);
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
}

const POS_PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'COD', 'RAZORPAY'] as const;

export async function createPosOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as {
      customerName: string;
      customerEmail?: string;
      customerPhone: string;
      shippingAddress: { name?: string; phone?: string; line1: string; line2?: string; city: string; state: string; pincode: string };
      items: Array<{ productId: string; variantId?: string; quantity: number; price?: number }>;
      paymentMethod: string;
      notes?: string;
    };

    if (!body.customerName || !body.customerPhone || !body.paymentMethod || !Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ success: false, error: 'customerName, customerPhone, paymentMethod and items are required' });
      return;
    }
    if (!POS_PAYMENT_METHODS.includes(body.paymentMethod as any)) {
      res.status(400).json({ success: false, error: `Invalid paymentMethod. Use: ${POS_PAYMENT_METHODS.join(', ')}` });
      return;
    }

    const addr = body.shippingAddress ?? {};
    if (!addr.line1 || !addr.city || !addr.state || !addr.pincode) {
      res.status(400).json({ success: false, error: 'shippingAddress (line1, city, state, pincode) is required' });
      return;
    }

    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { variants: { where: { isActive: true }, select: { id: true, name: true, price: true, sku: true, quantity: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const variantIds = body.items.map((i) => i.variantId).filter((id): id is string => Boolean(id));
    const variants = variantIds.length
      ? await prisma.productVariant.findMany({ where: { id: { in: variantIds } } })
      : [];
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    type Line = { productId: string; variantId: string | null; quantity: number; unitPrice: number; productName: string; productSku: string; productImage: string | null; productSlug: string; stockTarget: 'product' | 'variant' };
    const lines: Line[] = [];

    for (const item of body.items) {
      const product = productMap.get(item.productId);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({ success: false, error: `Invalid product or quantity for id: ${item.productId}` });
        return;
      }
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant) { res.status(400).json({ success: false, error: `Variant not found: ${item.variantId}` }); return; }
        lines.push({ productId: product.id, variantId: variant.id, quantity, unitPrice: item.price ?? Number(variant.price), productName: `${product.name} — ${variant.name}`, productSku: (variant.sku || product.sku).slice(0, 20), productImage: product.image, productSlug: product.slug, stockTarget: 'variant' });
      } else {
        lines.push({ productId: product.id, variantId: null, quantity, unitPrice: item.price ?? Number(product.salePrice ?? product.mrp), productName: product.name, productSku: product.sku, productImage: product.image, productSlug: product.slug, stockTarget: 'product' });
      }
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    const orderNumber = `POS-${Date.now().toString(36).toUpperCase()}`;

    const order = await prisma.$transaction(async (tx) => {
      for (const line of lines) {
        const affected = line.stockTarget === 'variant' && line.variantId
          ? await tx.$executeRaw`UPDATE product_variants SET quantity = quantity - ${line.quantity} WHERE id = ${line.variantId}::uuid AND quantity >= ${line.quantity}`
          : await tx.$executeRaw`UPDATE products SET quantity = quantity - ${line.quantity} WHERE id = ${line.productId}::uuid AND quantity >= ${line.quantity}`;
        if (affected === 0) throw new Error(`Out of stock: ${line.productName}`);
      }
      return tx.order.create({
        data: {
          orderNumber,
          channel: 'POS',
          customerName: body.customerName,
          customerEmail: body.customerEmail ?? '',
          customerPhone: body.customerPhone,
          shippingFullName: addr.name ?? body.customerName,
          shippingPhone: addr.phone ?? body.customerPhone,
          shippingAddressLine1: addr.line1,
          shippingAddressLine2: addr.line2 ?? null,
          shippingCity: addr.city,
          shippingState: addr.state,
          shippingPincode: addr.pincode,
          customerNotes: body.notes ?? null,
          subtotal,
          discount: 0,
          shippingCharge: 0,
          total: subtotal,
          paymentMethod: body.paymentMethod as PaymentMethod,
          paymentStatus: PaymentStatus.PAID,
          status: OrderStatus.CONFIRMED,
          items: { create: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, productName: l.productName, productSku: l.productSku, productImage: l.productImage, productSlug: l.productSlug, quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.unitPrice * l.quantity })) },
        },
        include: { items: true },
      });
    });

    res.status(201).json({ success: true, data: { order: { id: order.id, orderNumber: order.orderNumber, total: order.total, status: order.status } } });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to create POS order';
    if (msg.startsWith('Out of stock')) { res.status(400).json({ success: false, error: msg }); return; }
    console.error('[createPosOrder]', error);
    res.status(500).json({ success: false, error: 'Failed to create POS order' });
  }
}
