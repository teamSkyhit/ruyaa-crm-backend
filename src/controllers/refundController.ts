import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse, PaginationMeta } from '../types';

const SECRETS_RX = /secret|key|password/i;

async function getRazorpayCredentials() {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ['razorpay_key_id', 'razorpay_key_secret'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.razorpay_key_id || !map.razorpay_key_secret) {
    throw new Error('Razorpay credentials not configured.');
  }
  return { keyId: map.razorpay_key_id, keySecret: map.razorpay_key_secret };
}

async function createRazorpayRefund(razorpayPaymentId: string, amountRupees: number) {
  const { keyId, keySecret } = await getRazorpayCredentials();
  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

  const response = await fetch(`https://api.razorpay.com/v1/payments/${razorpayPaymentId}/refund`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100) }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Razorpay refund failed: ${err}`);
  }

  return response.json() as Promise<{ id: string }>;
}

export const listRefunds = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (req.query.status) where.status = req.query.status;
    if (req.query.orderId) where.orderId = req.query.orderId;

    const [total, refunds] = await Promise.all([
      prisma.refund.count({ where }),
      prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              total: true,
              paymentMethod: true,
              channel: true,
            },
          },
        },
      }),
    ]);

    const meta: PaginationMeta = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };

    res.json({ success: true, data: refunds, meta } as ApiResponse);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to list refunds' } as ApiResponse);
  }
};

export const getRefund = async (req: Request, res: Response) => {
  try {
    const refund = await prisma.refund.findUnique({
      where: { id: req.params.id },
      include: {
        order: {
          select: {
            orderNumber: true,
            total: true,
            paymentMethod: true,
            channel: true,
            customerName: true,
            customerEmail: true,
          },
        },
      },
    });

    if (!refund) {
      res.status(404).json({ success: false, error: 'Refund not found' } as ApiResponse); return;
    }

    res.json({ success: true, data: refund } as ApiResponse);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to get refund' } as ApiResponse);
  }
};

export const createRefund = async (req: Request, res: Response) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId || !amount) {
      return res
        .status(400)
        .json({ success: false, error: 'orderId and amount are required' } as ApiResponse);
    }

    const refundAmount = parseFloat(amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return res
        .status(400)
        .json({ success: false, error: 'amount must be a positive number' } as ApiResponse);
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' } as ApiResponse); return;
    }

    if (order.paymentStatus !== 'PAID') {
      return res
        .status(400)
        .json({ success: false, error: 'Only paid orders can be refunded' } as ApiResponse);
    }

    if (refundAmount > Number(order.total)) {
      return res
        .status(400)
        .json({ success: false, error: 'Refund amount cannot exceed order total' } as ApiResponse);
    }

    const existingRefund = await prisma.refund.findFirst({
      where: { orderId, status: { in: ['INITIATED', 'PROCESSED'] } },
    });
    if (existingRefund) {
      return res
        .status(400)
        .json({ success: false, error: 'A refund already exists for this order' } as ApiResponse);
    }

    let razorpayRefundId: string | null = null;
    let status: 'INITIATED' | 'PROCESSED' = 'PROCESSED';

    if (order.paymentMethod === 'RAZORPAY') {
      if (!order.razorpayPaymentId) {
        return res
          .status(400)
          .json({ success: false, error: 'No Razorpay payment ID on this order' } as ApiResponse);
      }
      const rzResult = await createRazorpayRefund(order.razorpayPaymentId, refundAmount);
      razorpayRefundId = rzResult.id;
      status = 'INITIATED';
    }
    // COD / CASH / UPI / CARD — money returned by staff; mark PROCESSED immediately

    const [refund] = await prisma.$transaction([
      prisma.refund.create({
        data: {
          orderId,
          razorpayRefundId,
          amount: refundAmount,
          reason: reason || null,
          status,
          initiatedById: req.user?.userId || null,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'REFUNDED', status: 'REFUNDED' },
      }),
      prisma.activityLog.create({
        data: {
          entityType: 'ORDER',
          entityId: orderId,
          entityName: order.orderNumber,
          action: 'UPDATE',
          details: `Refund of ₹${refundAmount} initiated`,
          userId: req.user?.userId || null,
          ipAddress: req.ip || null,
        },
      }),
    ]);

    return res.status(201).json({ success: true, data: refund } as ApiResponse);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create refund';
    return res.status(500).json({ success: false, error: message } as ApiResponse);
  }
};

export const updateRefundStatus = async (req: Request, res: Response) => {
  try {
    const { status } = req.body;

    if (!status || !['PROCESSED', 'FAILED'].includes(status)) {
      return res
        .status(400)
        .json({ success: false, error: 'status must be PROCESSED or FAILED' } as ApiResponse);
    }

    const refund = await prisma.refund.findUnique({ where: { id: req.params.id } });
    if (!refund) {
      res.status(404).json({ success: false, error: 'Refund not found' } as ApiResponse); return;
    }

    if (refund.status !== 'INITIATED') {
      return res
        .status(400)
        .json({ success: false, error: 'Only INITIATED refunds can be updated' } as ApiResponse);
    }

    const updated = await prisma.refund.update({
      where: { id: req.params.id },
      data: { status },
    });

    return res.json({ success: true, data: updated } as ApiResponse);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update refund status' } as ApiResponse);
  }
};
