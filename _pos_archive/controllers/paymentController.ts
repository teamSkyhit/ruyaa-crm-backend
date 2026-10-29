import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { PaymentMethod } from '@prisma/client';

/**
 * Create payment for a sale (for split payments)
 */
export const createPayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { saleId, method, amount, transactionId, notes } = req.body;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    if (!saleId || !method || !amount) {
      res.status(400).json({
        success: false,
        message: 'saleId, method, and amount are required',
      });
      return;
    }

    // Validate payment method
    if (!Object.values(PaymentMethod).includes(method)) {
      res.status(400).json({
        success: false,
        message: 'Invalid payment method. Must be CASH, UPI, CARD, or WALLET',
      });
      return;
    }

    // Validate amount
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      res.status(400).json({
        success: false,
        message: 'Amount must be a positive number',
      });
      return;
    }

    // Verify sale exists
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        payments: true,
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
      return;
    }

    // Calculate total payments already made
    const totalPaid = sale.payments.reduce(
      (sum, payment) => sum + Number(payment.amount),
      0
    );

    // Check if payment exceeds remaining balance
    const remainingBalance = Number(sale.finalAmount) - totalPaid;
    if (paymentAmount > remainingBalance) {
      res.status(400).json({
        success: false,
        message: `Payment amount (${paymentAmount}) exceeds remaining balance (${remainingBalance})`,
      });
      return;
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        saleId,
        method: method as PaymentMethod,
        amount: paymentAmount,
        transactionId: transactionId || null,
        notes: notes || null,
      },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true,
            finalAmount: true,
          },
        },
      },
    });

    // Calculate new total paid
    const newTotalPaid = totalPaid + paymentAmount;
    const isFullyPaid = newTotalPaid >= Number(sale.finalAmount);

    res.status(201).json({
      success: true,
      data: payment,
      message: 'Payment created successfully',
      meta: {
        totalPaid: newTotalPaid,
        remainingBalance: Number(sale.finalAmount) - newTotalPaid,
        isFullyPaid,
      },
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment',
    });
  }
};

/**
 * Get payments for a sale
 */
export const getPaymentsBySale = async (req: Request, res: Response): Promise<void> => {
  try {
    const { saleId } = req.params;

    const payments = await prisma.payment.findMany({
      where: { saleId },
      orderBy: { createdAt: 'asc' },
    });

    const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);

    // Get sale to calculate remaining balance
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: {
        id: true,
        finalAmount: true,
      },
    });

    const remainingBalance = sale
      ? Number(sale.finalAmount) - totalPaid
      : 0;

    res.json({
      success: true,
      data: payments,
      meta: {
        totalPaid,
        remainingBalance,
        isFullyPaid: remainingBalance <= 0,
      },
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
    });
  }
};

/**
 * Delete a payment
 */
export const deletePayment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    const payment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!payment) {
      res.status(404).json({
        success: false,
        message: 'Payment not found',
      });
      return;
    }

    await prisma.payment.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete payment',
    });
  }
};

