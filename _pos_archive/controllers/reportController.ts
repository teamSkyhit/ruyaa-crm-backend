import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';

/**
 * Get Sales Report
 * Supports filtering by date range, store, counter, and export to Excel
 */
export const getSalesReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startDate,
      endDate,
      storeId,
      counterId,
      page = '1',
      limit = '100',
      export: exportFormat,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }

    if (storeId) where.storeId = storeId as string;
    if (counterId) where.counterId = counterId as string;

    // Get sales grouped by receipt number
    const sales = await prisma.sale.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        counter: {
          select: {
            id: true,
            name: true,
          },
        },
        payments: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { saleDate: 'desc' },
      skip,
      take: limitNum,
    });

    // Group by receipt number
    const receiptMap = new Map();
    sales.forEach((sale) => {
      const receiptNumber = sale.saleNumber || 'UNKNOWN';
      if (!receiptMap.has(receiptNumber)) {
        receiptMap.set(receiptNumber, {
          receiptNumber,
          saleDate: sale.saleDate,
          store: sale.store,
          counter: sale.counter,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          items: [],
          totalSubtotal: 0,
          totalDiscount: 0,
          totalTaxable: 0,
          totalGst: 0,
          totalFinal: 0,
          payments: [],
          createdBy: sale.createdBy,
        });
      }
      const receipt = receiptMap.get(receiptNumber);
      receipt.items.push({
        product: sale.product,
        quantity: sale.quantitySold,
        unitPrice: Number(sale.unitPrice),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discountAmount || 0),
        taxable: Number(sale.taxableAmount),
        gst: Number(sale.gstAmount || 0),
        final: Number(sale.finalAmount),
      });
      receipt.totalSubtotal += Number(sale.subtotal);
      receipt.totalDiscount += Number(sale.discountAmount || 0);
      receipt.totalTaxable += Number(sale.taxableAmount);
      receipt.totalGst += Number(sale.gstAmount || 0);
      receipt.totalFinal += Number(sale.finalAmount);
      
      // Collect unique payments (group by payment ID)
      sale.payments.forEach((payment) => {
        if (!receipt.payments.find((p: any) => p.id === payment.id)) {
          receipt.payments.push(payment);
        }
      });
    });

    const receipts = Array.from(receiptMap.values());

    // Calculate summary
    const summary = {
      totalReceipts: receipts.length,
      totalItems: sales.length,
      totalSubtotal: receipts.reduce((sum, r) => sum + r.totalSubtotal, 0),
      totalDiscount: receipts.reduce((sum, r) => sum + r.totalDiscount, 0),
      totalTaxable: receipts.reduce((sum, r) => sum + r.totalTaxable, 0),
      totalGst: receipts.reduce((sum, r) => sum + r.totalGst, 0),
      totalFinal: receipts.reduce((sum, r) => sum + r.totalFinal, 0),
    };

    const total = await prisma.sale.count({ where });

    const response: ApiResponse<any> = {
      success: true,
      data: {
        receipts,
        summary,
      },
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching sales report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sales report',
    });
  }
};

/**
 * Get GST Report (GSTR-1 format, HSN-wise)
 */
export const getGstReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId } = req.query;

    const where: any = {};
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }
    if (storeId) where.storeId = storeId as string;

    const sales = await prisma.sale.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // Group by HSN code
    const hsnMap = new Map();
    sales.forEach((sale) => {
      const hsnCode = sale.product.category.hsnCode || 'N/A';
      const gstRate = sale.gstRate || 0;

      if (!hsnMap.has(hsnCode)) {
        hsnMap.set(hsnCode, {
          hsnCode,
          gstRate,
          description: sale.product.category.name,
          quantity: 0,
          taxableValue: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
          totalGst: 0,
        });
      }

      const hsnData = hsnMap.get(hsnCode);
      hsnData.quantity += sale.quantitySold;
      hsnData.taxableValue += Number(sale.taxableAmount);
      hsnData.cgst += Number(sale.cgstAmount || 0);
      hsnData.sgst += Number(sale.sgstAmount || 0);
      hsnData.igst += Number(sale.igstAmount || 0);
      hsnData.totalGst += Number(sale.gstAmount || 0);
    });

    const hsnWiseData = Array.from(hsnMap.values());

    // Calculate totals
    const totals = {
      totalQuantity: hsnWiseData.reduce((sum, h) => sum + h.quantity, 0),
      totalTaxableValue: hsnWiseData.reduce((sum, h) => sum + h.taxableValue, 0),
      totalCgst: hsnWiseData.reduce((sum, h) => sum + h.cgst, 0),
      totalSgst: hsnWiseData.reduce((sum, h) => sum + h.sgst, 0),
      totalIgst: hsnWiseData.reduce((sum, h) => sum + h.igst, 0),
      totalGst: hsnWiseData.reduce((sum, h) => sum + h.totalGst, 0),
    };

    res.json({
      success: true,
      data: {
        hsnWiseData,
        totals,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching GST report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch GST report',
    });
  }
};

/**
 * Get Payment Mode Report
 */
export const getPaymentModeReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId, counterId } = req.query;

    const saleWhere: any = {};
    if (startDate || endDate) {
      saleWhere.saleDate = {};
      if (startDate) saleWhere.saleDate.gte = new Date(startDate as string);
      if (endDate) saleWhere.saleDate.lte = new Date(endDate as string);
    }
    if (storeId) saleWhere.storeId = storeId as string;
    if (counterId) saleWhere.counterId = counterId as string;

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: {
        payments: true,
      },
    });

    // Group by payment method
    const paymentStats: Record<string, { count: number; amount: number }> = {
      CASH: { count: 0, amount: 0 },
      UPI: { count: 0, amount: 0 },
      CARD: { count: 0, amount: 0 },
      WALLET: { count: 0, amount: 0 },
    };

    let totalPayments = 0;
    let totalAmount = 0;
    let splitPaymentsCount = 0;

    sales.forEach((sale) => {
      if (sale.payments.length > 0) {
        if (sale.payments.length > 1) {
          splitPaymentsCount++;
        }
        sale.payments.forEach((payment) => {
          const method = payment.method;
          if (paymentStats[method]) {
            paymentStats[method].count++;
            paymentStats[method].amount += Number(payment.amount);
            totalPayments++;
            totalAmount += Number(payment.amount);
          }
        });
      }
    });

    res.json({
      success: true,
      data: {
        paymentStats,
        summary: {
          totalPayments,
          totalAmount,
          splitPaymentsCount,
          singlePaymentCount: totalPayments - splitPaymentsCount,
        },
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching payment mode report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment mode report',
    });
  }
};

/**
 * Get Inventory Report
 */
export const getInventoryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, lowStock, categoryId } = req.query;

    let products;
    // Filter out 'undefined', 'null', and 'all' strings
    if (storeId && storeId !== 'all' && storeId !== 'undefined' && storeId !== 'null') {
      // Store-level inventory
      const whereClause: any = {
        storeId: storeId as string,
      };

      // Apply low stock filter if requested
      if (lowStock === 'true') {
        // We'll filter after fetching since we need to compare with product/category minStockLevel
        // This is done in the mapping below
      }

      const storeInventory = await prisma.storeProductInventory.findMany({
        where: whereClause,
        include: {
          product: {
            include: {
              category: true,
            },
          },
          store: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      products = storeInventory.map((inv) => ({
        product: inv.product,
        store: inv.store,
        quantity: inv.quantity,
        minStockLevel: inv.minStockLevel || inv.product.category.minStockLevel || 0,
        isLowStock: inv.quantity <= (inv.minStockLevel || inv.product.category.minStockLevel || 0),
        value: Number(inv.product.price) * inv.quantity,
      }));

      // Filter low stock items if requested
      if (lowStock === 'true') {
        products = products.filter((p) => p.isLowStock);
      }
    } else {
      // Global inventory
      const where: any = {};
      if (categoryId) where.categoryId = categoryId as string;

      const allProducts = await prisma.product.findMany({
        where,
        include: {
          category: true,
        },
      });

      products = allProducts.map((product) => {
        const minStock = product.minStockLevel || product.category.minStockLevel || 0;
        return {
          product,
          store: null,
          quantity: product.quantity,
          minStockLevel: minStock,
          isLowStock: product.quantity <= minStock,
          value: Number(product.price) * product.quantity,
        };
      });

      if (lowStock === 'true') {
        products = products.filter((p) => p.isLowStock);
      }
    }

    // Calculate summary
    const summary = {
      totalProducts: products.length,
      lowStockCount: products.filter((p) => p.isLowStock).length,
      totalValue: products.reduce((sum, p) => sum + p.value, 0),
      totalQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
    };

    res.json({
      success: true,
      data: {
        products,
        summary,
      },
    });
  } catch (error: any) {
    console.error('Error fetching inventory report:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch inventory report',
    });
  }
};

/**
 * Get Cash Reconciliation Report
 * Groups cash payments by counter/store for the given period (shift-free).
 */
export const getCashReconciliationReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId, counterId } = req.query;

    const saleWhere: any = {};
    if (startDate || endDate) {
      saleWhere.saleDate = {};
      if (startDate) saleWhere.saleDate.gte = new Date(startDate as string);
      if (endDate) saleWhere.saleDate.lte = new Date(endDate as string);
    }
    if (storeId) saleWhere.storeId = storeId as string;
    if (counterId) saleWhere.counterId = counterId as string;

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: {
        payments: {
          where: { method: 'CASH' },
        },
        counter: {
          include: {
            store: {
              select: { id: true, name: true },
            },
          },
        },
      },
      orderBy: { saleDate: 'desc' },
    });

    // Group by counter
    const counterMap = new Map<string, {
      counterId: string;
      counterName: string;
      store: { id: string; name: string } | null;
      saleCount: number;
      cashAmount: number;
    }>();

    for (const sale of sales) {
      const key = sale.counterId || 'NO_COUNTER';
      if (!counterMap.has(key)) {
        counterMap.set(key, {
          counterId: key,
          counterName: sale.counter?.name || 'No Counter',
          store: sale.counter?.store || null,
          saleCount: 0,
          cashAmount: 0,
        });
      }
      const entry = counterMap.get(key)!;
      const cashForSale = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
      if (cashForSale > 0) {
        entry.saleCount++;
        entry.cashAmount += cashForSale;
      }
    }

    const reconciliationData = Array.from(counterMap.values());

    const summary = {
      totalCounters: reconciliationData.length,
      totalCashSales: reconciliationData.reduce((sum, c) => sum + c.saleCount, 0),
      totalCashAmount: reconciliationData.reduce((sum, c) => sum + c.cashAmount, 0),
      period: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    };

    res.json({
      success: true,
      data: {
        counters: reconciliationData,
        summary,
      },
    });
  } catch (error) {
    console.error('Error fetching cash reconciliation report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cash reconciliation report',
    });
  }
};

/**
 * Get Recent Consolidated Bills (for POS sidebar)
 */
export const getRecentBills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId, limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 50);

    const where: any = {
      orderStatus: 'COMPLETED',
      consolidatedReceiptNumber: { not: null },
    };
    if (counterId) where.counterId = counterId as string;

    // Get recent completed sales, then group by consolidatedReceiptNumber in JS
    const sales = await prisma.sale.findMany({
      where,
      select: {
        consolidatedReceiptNumber: true,
        finalAmount: true,
        saleDate: true,
      },
      orderBy: { saleDate: 'desc' },
      take: limitNum * 10, // fetch enough rows to cover limitNum unique receipts
    });

    // Group by consolidated receipt number
    const receiptMap = new Map<string, { totalAmount: number; saleDate: Date; itemCount: number }>();
    for (const sale of sales) {
      const rcpt = sale.consolidatedReceiptNumber!;
      const existing = receiptMap.get(rcpt);
      if (existing) {
        existing.totalAmount += Number(sale.finalAmount);
        existing.itemCount++;
        if (sale.saleDate > existing.saleDate) existing.saleDate = sale.saleDate;
      } else {
        receiptMap.set(rcpt, {
          totalAmount: Number(sale.finalAmount),
          saleDate: sale.saleDate,
          itemCount: 1,
        });
      }
    }

    // Sort by date desc and take limit
    const data = Array.from(receiptMap.entries())
      .sort((a, b) => b[1].saleDate.getTime() - a[1].saleDate.getTime())
      .slice(0, limitNum)
      .map(([receiptNumber, info]) => ({
        receiptNumber,
        totalAmount: info.totalAmount,
        saleDate: info.saleDate,
        itemCount: info.itemCount,
      }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching recent bills:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent bills' });
  }
};

/**
 * Get Counter-wise Report
 */
export const getCounterWiseReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, storeId } = req.query;

    const saleWhere: any = {};
    if (startDate || endDate) {
      saleWhere.saleDate = {};
      if (startDate) saleWhere.saleDate.gte = new Date(startDate as string);
      if (endDate) saleWhere.saleDate.lte = new Date(endDate as string);
    }
    if (storeId) saleWhere.storeId = storeId as string;

    const sales = await prisma.sale.findMany({
      where: saleWhere,
      include: {
        counter: {
          include: {
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        payments: true,
      },
    });

    // Group by counter
    const counterMap = new Map();
    sales.forEach((sale) => {
      const counterId = sale.counterId || 'NO_COUNTER';
      const counterName = sale.counter?.name || 'No Counter';
      const storeName = sale.counter?.store?.name || 'Unknown Store';

      if (!counterMap.has(counterId)) {
        counterMap.set(counterId, {
          counterId,
          counterName,
          storeName,
          receiptCount: 0,
          itemCount: 0,
          totalSubtotal: 0,
          totalDiscount: 0,
          totalTaxable: 0,
          totalGst: 0,
          totalFinal: 0,
          paymentStats: {
            CASH: 0,
            UPI: 0,
            CARD: 0,
            WALLET: 0,
          },
        });
      }

      const counterData = counterMap.get(counterId);
      counterData.itemCount++;
      counterData.totalSubtotal += Number(sale.subtotal);
      counterData.totalDiscount += Number(sale.discountAmount || 0);
      counterData.totalTaxable += Number(sale.taxableAmount);
      counterData.totalGst += Number(sale.gstAmount || 0);
      counterData.totalFinal += Number(sale.finalAmount);

      // Count unique receipts
      if (sale.saleNumber) {
        const receiptNumbers = new Set();
        sales.forEach((s) => {
          if (s.counterId === counterId && s.saleNumber) {
            receiptNumbers.add(s.saleNumber);
          }
        });
        counterData.receiptCount = receiptNumbers.size;
      }

      // Payment stats
      sale.payments.forEach((payment) => {
        if (counterData.paymentStats[payment.method]) {
          counterData.paymentStats[payment.method] += Number(payment.amount);
        }
      });
    });

    const counterData = Array.from(counterMap.values());

    res.json({
      success: true,
      data: {
        counters: counterData,
        summary: {
          totalCounters: counterData.length,
          totalReceipts: counterData.reduce((sum, c) => sum + c.receiptCount, 0),
          totalItems: counterData.reduce((sum, c) => sum + c.itemCount, 0),
          totalFinal: counterData.reduce((sum, c) => sum + c.totalFinal, 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching counter-wise report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch counter-wise report',
    });
  }
};

