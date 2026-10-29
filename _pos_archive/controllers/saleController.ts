// src/controllers/saleController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { createActivityLog } from './activityController';
import { generateNextReceiptNumber } from '../services/receiptNumberService';
import { calculateGST, gstRateEnumToNumber, isInterStateSale } from '../services/gstService';
import { calculateDiscount } from '../services/discountService';
import { PaymentMethod } from '@prisma/client';

interface SaleItem {
  productId: string;
  quantity: number;
  discountPercent?: number;
  discountAmount?: number;
}

interface PaymentInput {
  method: PaymentMethod;
  amount: number;
  transactionId?: string;
  notes?: string;
}

interface CreateSaleInput {
  items: SaleItem[];
  storeId: string;
  counterId?: string;
  withoutGst?: boolean;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  payments?: PaymentInput[];
}

async function getAllSales(req: Request, res: Response): Promise<void> {
  try {
    const {
      storeId,
      counterId,
      shiftId,
      startDate,
      endDate,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (storeId) where.storeId = storeId as string;
    if (counterId) where.counterId = counterId as string;
    if (shiftId) where.shiftId = shiftId as string;

    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate as string);
      if (endDate) where.saleDate.lte = new Date(endDate as string);
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          product: {
            include: {
              category: {
                select: {
                  id: true,
                  name: true,
                  hsnCode: true,
                  gstRate: true,
                  gstInclusive: true,
                },
              },
            },
          },
          store: {
            select: {
              id: true,
              name: true,
              gstin: true,
              address: true,
              city: true,
              state: true,
              pincode: true,
              contact: true,
              email: true,
              logoUrl: true,
            },
          },
          counter: {
            select: {
              id: true,
              name: true,
            },
          },
          shift: {
            select: {
              id: true,
              shiftNumber: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: { saleDate: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.sale.count({ where }),
    ]);

    const response: ApiResponse<any[]> = {
      success: true,
      data: sales,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching sales:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch sales',
    };
    res.status(500).json(response);
  }
}

async function createSale(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
      return;
    }

    // BUG-007 FIX: Idempotency check — if the client sends the same X-Idempotency-Key
    // header on a retry, return the already-created receipt instead of creating a duplicate.
    const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;
    if (idempotencyKey) {
      const existingSale = await prisma.sale.findFirst({
        where: { idempotencyKey },
        include: { payments: true },
      });
      if (existingSale) {
        res.status(200).json({
          success: true,
          idempotent: true,
          message: 'Sale already processed (idempotent replay)',
          data: { saleNumber: existingSale.saleNumber },
        });
        return;
      }
    }

    const {
      items,
      storeId,
      counterId,
      withoutGst = false,
      customerName,
      customerPhone,
      customerEmail,
      payments,
    }: CreateSaleInput = req.body;

    // --- Input validation (before transaction) ---
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Items array is required and must not be empty',
      });
      return;
    }

    if (!storeId) {
      res.status(400).json({
        success: false,
        message: 'storeId is required',
      });
      return;
    }

    // Validate all items have required fields upfront
    for (let i = 0; i < items.length; i++) {
      const { productId, quantity } = items[i];
      if (!productId) {
        res.status(400).json({
          success: false,
          message: `Item at index ${i} is missing productId`,
        });
        return;
      }
      if (!quantity || quantity <= 0) {
        res.status(400).json({
          success: false,
          message: `Item at index ${i} has invalid quantity: ${quantity}`,
        });
        return;
      }
    }

    // Validate payments upfront (before persisting anything)
    if (payments && payments.length > 0) {
      for (let i = 0; i < payments.length; i++) {
        if (!payments[i].method || !payments[i].amount || payments[i].amount <= 0) {
          res.status(400).json({
            success: false,
            message: `Payment at index ${i} has invalid method or amount`,
          });
          return;
        }
      }
    }

    // Verify store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      select: { id: true, name: true, state: true },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    // Verify counter if provided
    if (counterId) {
      const counter = await prisma.counter.findUnique({
        where: { id: counterId },
      });
      if (!counter) {
        res.status(404).json({
          success: false,
          message: 'Counter not found',
        });
        return;
      }
    }

    // --- Batch-fetch all products upfront (avoid N+1) ---
    const productIds = items.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { category: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate all products exist
    for (const item of items) {
      if (!productMap.has(item.productId)) {
        res.status(400).json({
          success: false,
          message: `Product not found: ${item.productId}`,
        });
        return;
      }
    }

    // Batch-fetch store inventory for all products
    const storeInventories = await prisma.storeProductInventory.findMany({
      where: {
        storeId,
        productId: { in: productIds },
      },
    });
    const inventoryMap = new Map(
      storeInventories.map((inv) => [inv.productId, inv])
    );

    // Pre-validate stock for all items
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const storeInv = inventoryMap.get(item.productId);
      const availableStock = storeInv ? storeInv.quantity : product.quantity;

      if (availableStock < item.quantity && !product.allowNegativeStock) {
        res.status(400).json({
          success: false,
          message: `Insufficient stock for ${product.name}. Available: ${availableStock}, Required: ${item.quantity}`,
        });
        return;
      }
    }

    // --- Pre-calculate totals to validate payments before transaction ---
    let preCalcTotalFinal = 0;
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      const unitPrice = Number(product.salePrice || product.price || product.mrp || 0);
      const subtotal = unitPrice * item.quantity;

      const discountResult = calculateDiscount({
        amount: subtotal,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        roundToNearestRupee: true,
      });

      const gstRate = Number(product.category.gstRate) || 0;
      if (withoutGst || gstRate === 0) {
        preCalcTotalFinal += discountResult.finalAmount;
      } else {
        const gstCalc = calculateGST({
          amount: discountResult.finalAmount,
          gstRate,
          gstInclusive: product.category.gstInclusive,
          isInterState: false,
        });
        preCalcTotalFinal += gstCalc.finalAmount;
      }
    }

    // Validate payments don't exceed total BEFORE persisting anything
    if (payments && payments.length > 0) {
      const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
      if (totalPaid > preCalcTotalFinal + 0.01) {
        // +0.01 for rounding tolerance
        res.status(400).json({
          success: false,
          message: `Total payments (${totalPaid}) exceed total amount (${preCalcTotalFinal.toFixed(2)})`,
        });
        return;
      }
    }

    // Generate receipt number before transaction
    const saleNumber = await generateNextReceiptNumber();

    // --- Execute everything inside a transaction ---
    const result = await prisma.$transaction(async (tx) => {
      const createdSales = [];
      let totalFinalAmount = 0;

      for (const item of items) {
        const product = productMap.get(item.productId)!;
        const { quantity, discountPercent, discountAmount } = item;

        const unitPrice = Number(product.salePrice || product.price || product.mrp || 0);
        const subtotal = unitPrice * quantity;

        const discountResult = calculateDiscount({
          amount: subtotal,
          discountPercent,
          discountAmount,
          roundToNearestRupee: true,
        });

        const taxableAmount = discountResult.finalAmount;
        const gstRate = Number(product.category.gstRate) || 0;
        const gstInclusive = product.category.gstInclusive;
        const isInterState = false; // TODO: Determine based on customer/store state

        let gstCalculation;
        if (withoutGst || gstRate === 0) {
          gstCalculation = {
            taxableAmount,
            gstRate: 0,
            gstAmount: 0,
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: 0,
            finalAmount: taxableAmount,
          };
        } else {
          gstCalculation = calculateGST({
            amount: taxableAmount,
            gstRate,
            gstInclusive,
            isInterState,
          });
        }

        const finalAmount = gstCalculation.finalAmount;
        totalFinalAmount += finalAmount;

        // Create sale record
        const sale = await tx.sale.create({
          data: {
            saleNumber,
            productId: item.productId,
            storeId,
            counterId: counterId || null,
            quantitySold: quantity,
            unitPrice,
            subtotal,
            discountPercent: discountResult.discountPercent
              ? Number(discountResult.discountPercent.toFixed(2))
              : null,
            discountAmount: discountResult.discountAmount > 0 ? discountResult.discountAmount : null,
            taxableAmount: gstCalculation.taxableAmount,
            gstRate: gstRate > 0 ? gstRate : null,
            gstAmount: gstRate > 0 && gstCalculation.gstAmount > 0 ? Number(gstCalculation.gstAmount.toFixed(2)) : null,
            cgstAmount: gstRate > 0 && !isInterState && gstCalculation.cgstAmount > 0 ? Number(gstCalculation.cgstAmount.toFixed(2)) : null,
            sgstAmount: gstRate > 0 && !isInterState && gstCalculation.sgstAmount > 0 ? Number(gstCalculation.sgstAmount.toFixed(2)) : null,
            igstAmount: gstRate > 0 && isInterState && gstCalculation.igstAmount > 0 ? Number(gstCalculation.igstAmount.toFixed(2)) : null,
            withoutGst,
            finalAmount,
            orderStatus: 'COMPLETED',
            customerName: customerName || null,
            customerPhone: customerPhone || null,
            customerEmail: customerEmail || null,
            createdById: userId,
            // BUG-007 FIX: Persist idempotency key on the first item so replay detection works
            idempotencyKey: idempotencyKey || null,
          },
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        });

        createdSales.push(sale);

        // Update inventory (store-level)
        await tx.storeProductInventory.upsert({
          where: {
            storeId_productId: {
              storeId,
              productId: item.productId,
            },
          },
          update: {
            quantity: {
              decrement: quantity,
            },
          },
          create: {
            storeId,
            productId: item.productId,
            quantity: -quantity,
          },
        });

        // Also decrement global product quantity
        await tx.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: quantity,
            },
          },
        });
      }

      // Create payments - link each to the FIRST sale (all share same saleNumber for receipt grouping)
      // This is by design: payments are fetched by saleNumber, not individual saleId
      const createdPayments = [];
      if (payments && payments.length > 0) {
        for (const payment of payments) {
          const paymentRecord = await tx.payment.create({
            data: {
              saleId: createdSales[0].id,
              method: payment.method,
              amount: payment.amount,
              transactionId: payment.transactionId || null,
              notes: payment.notes || null,
            },
          });
          createdPayments.push(paymentRecord);
        }
      }

      return { createdSales, createdPayments, totalFinalAmount };
    });

    // Activity log (outside transaction - non-critical)
    await createActivityLog({
      entityType: 'SALE',
      entityId: result.createdSales[0].id,
      entityName: `Sale ${saleNumber}`,
      action: 'CREATE',
      category: 'Sales',
      details: `Created sale with ${items.length} item(s). Total: ${result.totalFinalAmount}`,
      userId,
      storeId,
    });

    const totalPaid = result.createdPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const response: ApiResponse<any> = {
      success: true,
      message: 'Sale created successfully',
      data: {
        saleNumber,
        sales: result.createdSales,
        payments: result.createdPayments,
        summary: {
          totalItems: items.length,
          totalFinalAmount: result.totalFinalAmount,
          totalPaid,
          remainingBalance: result.totalFinalAmount - totalPaid,
        },
      },
    };
    res.status(201).json(response);
  } catch (error: any) {
    console.error('Error creating sale:', error);
    const response: ApiResponse = {
      success: false,
      message: error.message || 'Failed to create sale',
    };
    res.status(500).json(response);
  }
}

async function updateSale(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { quantity, discountPercent, discountAmount } = req.body;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
      return;
    }

    // Recalculate if quantity or discount changed
    const unitPrice = Number(sale.unitPrice);
    const newQuantity = quantity || sale.quantitySold;
    const newSubtotal = unitPrice * newQuantity;

    const discountResult = calculateDiscount({
      amount: newSubtotal,
      discountPercent: discountPercent !== undefined ? discountPercent : sale.discountPercent,
      discountAmount: discountAmount !== undefined ? discountAmount : sale.discountAmount,
      roundToNearestRupee: true,
    });

    // gstRate is a Decimal from database, convert to number
    const gstRate = Number(sale.product.category.gstRate) || 0;
    const gstInclusive = sale.product.category.gstInclusive;

    let gstCalculation;
    if (sale.withoutGst || gstRate === 0) {
      gstCalculation = {
        taxableAmount: discountResult.finalAmount,
        gstRate: 0,
        gstAmount: 0,
        cgstAmount: 0,
        sgstAmount: 0,
        igstAmount: 0,
        finalAmount: discountResult.finalAmount,
      };
    } else {
      gstCalculation = calculateGST({
        amount: discountResult.finalAmount,
        gstRate,
        gstInclusive,
        isInterState: false,
      });
    }

    // Determine if inter-state (for now, default to intra-state)
    const isInterState = false; // TODO: Determine based on customer/store state

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: {
        quantitySold: newQuantity,
        subtotal: newSubtotal,
        discountPercent: discountResult.discountPercent
          ? Number(discountResult.discountPercent.toFixed(2))
          : null,
        discountAmount: discountResult.discountAmount > 0 ? discountResult.discountAmount : null,
        taxableAmount: gstCalculation.taxableAmount,
        gstAmount: gstRate > 0 && gstCalculation.gstAmount > 0 ? Number(gstCalculation.gstAmount.toFixed(2)) : null,
        // Save CGST/SGST if GST rate > 0 and intra-state
        // Only save if calculated amount is positive (handles rounding edge cases)
        cgstAmount: gstRate > 0 && !isInterState && gstCalculation.cgstAmount > 0 ? Number(gstCalculation.cgstAmount.toFixed(2)) : null,
        sgstAmount: gstRate > 0 && !isInterState && gstCalculation.sgstAmount > 0 ? Number(gstCalculation.sgstAmount.toFixed(2)) : null,
        // Save IGST if GST rate > 0 and inter-state
        igstAmount: gstRate > 0 && isInterState && gstCalculation.igstAmount > 0 ? Number(gstCalculation.igstAmount.toFixed(2)) : null,
        finalAmount: gstCalculation.finalAmount,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        payments: true,
      },
    });

    res.json({
      success: true,
      message: 'Sale updated successfully',
      data: updatedSale,
    });
  } catch (error: any) {
    console.error('Error updating sale:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update sale',
    });
  }
}

/**
 * Get sale by ID
 */
async function getSaleById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                hsnCode: true,
                gstRate: true,
                gstInclusive: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            gstin: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            contact: true,
            email: true,
            logoUrl: true,
          },
        },
        counter: {
          select: { id: true, name: true },
        },
        shift: {
          select: { id: true, shiftNumber: true, status: true },
        },
        payments: true,
      },
    });

    if (!sale) {
      res.status(404).json({ success: false, error: 'Sale not found' });
      return;
    }

    const response: ApiResponse<any> = { success: true, data: sale };
    res.json(response);
  } catch (error) {
    console.error('Error fetching sale by ID:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch sale',
    };
    res.status(500).json(response);
  }
}

/**
 * GET /api/sales/customer-lookup?phone=XXXXXXXXXX
 * Returns the most recent customerName for a given phone number
 */
export async function getCustomerByPhone(req: Request, res: Response): Promise<void> {
  try {
    const { phone } = req.query;
    if (!phone || String(phone).length < 6) {
      res.status(400).json({ success: false, error: 'phone is required (min 6 digits)' });
      return;
    }

    const sale = await (prisma as any).sale.findFirst({
      where: {
        customerPhone: String(phone),
        customerName: { not: null },
        orderStatus: 'COMPLETED',
      },
      select: { customerName: true, customerPhone: true },
      orderBy: { saleDate: 'desc' },
    });

    if (!sale) {
      res.json({ success: true, data: null });
      return;
    }

    res.json({ success: true, data: { customerName: sale.customerName, customerPhone: sale.customerPhone } });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Lookup failed' });
  }
}

/**
 * Get receipt by saleNumber (groups all items for a receipt)
 */
async function getReceiptByNumber(req: Request, res: Response): Promise<void> {
  try {
    const { saleNumber } = req.params;

    if (!saleNumber) {
      res.status(400).json({ success: false, error: 'Sale number is required' });
      return;
    }

    // Look up by saleNumber (RCP-xxx) or consolidatedReceiptNumber (GPS-xxx)
    const sales = await prisma.sale.findMany({
      where: {
        OR: [
          { saleNumber },
          { consolidatedReceiptNumber: saleNumber },
        ],
      },
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
                hsnCode: true,
                gstRate: true,
                gstInclusive: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        store: {
          select: {
            id: true,
            name: true,
            gstin: true,
            address: true,
            city: true,
            state: true,
            pincode: true,
            contact: true,
            email: true,
            logoUrl: true,
          },
        },
        counter: {
          select: { id: true, name: true },
        },
        shift: {
          select: { id: true, shiftNumber: true, status: true },
        },
        payments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { saleDate: 'asc' },
    });

    if (sales.length === 0) {
      res.status(404).json({ success: false, error: 'Receipt not found' });
      return;
    }

    // Group into receipt format
    const receipt = {
      saleNumber: sales[0].saleNumber,
      saleDate: sales[0].saleDate,
      store: sales[0].store,
      counter: sales[0].counter,
      shift: sales[0].shift,
      customerName: sales[0].customerName,
      customerPhone: sales[0].customerPhone,
      customerEmail: sales[0].customerEmail,
      createdBy: sales[0].createdBy,
      items: sales,
      payments: sales[0].payments || [],
    };

    const response: ApiResponse<any> = { success: true, data: receipt };
    res.json(response);
  } catch (error) {
    console.error('Error fetching receipt by number:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch receipt',
    };
    res.status(500).json(response);
  }
}

export { getAllSales, getSaleById, getReceiptByNumber, createSale, updateSale };
