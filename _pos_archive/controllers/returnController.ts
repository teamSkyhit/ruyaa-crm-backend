import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { generateNextReturnNumber } from '../services/returnNumberService';
import { createActivityLog } from './activityController';
import { ReturnReason, ReturnStatus } from '@prisma/client';

/**
 * Get all returns
 */
export const getAllReturns = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      startDate,
      endDate,
      status,
      storeId,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const where: any = {};

    if (status) where.status = status;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // If storeId is provided, filter by originalSale.storeId
    // Note: We need to filter through the originalSale relation
    if (storeId && storeId !== 'undefined' && storeId !== 'null' && storeId !== 'all') {
      // Get sales for this store first, then filter returns
      const storeSales = await prisma.sale.findMany({
        where: { storeId: storeId as string },
        select: { id: true },
      });
      const saleIds = storeSales.map((s) => s.id);
      if (saleIds.length > 0) {
        where.originalSaleId = { in: saleIds };
      } else {
        // No sales for this store, return empty
        res.json({
          success: true,
          data: [],
          meta: {
            page: pageNum,
            limit: limitNum,
            total: 0,
            totalPages: 0,
          },
        });
        return;
      }
    }

    const returns = await prisma.return.findMany({
      where,
      include: {
        originalSale: {
          include: {
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
          },
        },
        sale: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        product: {
          include: {
            category: true,
          },
        },
        exchangeProduct: {
          include: {
            category: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });

    const total = await prisma.return.count({ where });

    res.json({
      success: true,
      data: returns,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Error fetching returns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch returns',
    });
  }
};

/**
 * Get return by ID
 */
export const getReturnById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const returnRecord = await prisma.return.findUnique({
      where: { id },
      include: {
        originalSale: {
          include: {
            store: true,
            counter: true,
            payments: true,
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        sale: {
          include: {
            product: {
              include: {
                category: true,
              },
            },
          },
        },
        product: {
          include: {
            category: true,
          },
        },
        exchangeProduct: {
          include: {
            category: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!returnRecord) {
      res.status(404).json({
        success: false,
        error: 'Return not found',
      });
      return;
    }

    res.json({
      success: true,
      data: returnRecord,
    });
  } catch (error) {
    console.error('Error fetching return:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch return',
    });
  }
};

/**
 * Search returns by receipt number
 */
export const searchReturnsByReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { receiptNumber } = req.query;

    if (!receiptNumber) {
      res.status(400).json({
        success: false,
        error: 'receiptNumber is required',
      });
      return;
    }

    // Find sale by receipt number
    const sale = await prisma.sale.findFirst({
      where: { saleNumber: receiptNumber as string },
      include: {
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
        product: {
          include: {
            category: true,
          },
        },
        payments: true,
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        error: 'Sale not found for the given receipt number',
      });
      return;
    }

    // Check if sale is within 7 days
    const saleDate = new Date(sale.saleDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 7) {
      res.status(400).json({
        success: false,
        error: 'Return period expired. Returns are only allowed within 7 days of purchase.',
      });
      return;
    }

    // Get all sale items for this receipt
    const allSaleItems = await prisma.sale.findMany({
      where: { saleNumber: receiptNumber as string },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // Get existing returns for this receipt
    const existingReturns = await prisma.return.findMany({
      where: { originalSaleId: sale.id },
      include: {
        sale: {
          include: {
            product: true,
          },
        },
      },
    });

    // Calculate returned quantities
    const returnedQuantities = new Map();
    existingReturns.forEach((ret) => {
      const key = ret.saleId;
      returnedQuantities.set(key, (returnedQuantities.get(key) || 0) + ret.quantity);
    });

    // Mark items that can still be returned
    const itemsWithReturnStatus = allSaleItems.map((item) => {
      const returnedQty = returnedQuantities.get(item.id) || 0;
      const remainingQty = item.quantitySold - returnedQty;
      return {
        ...item,
        returnedQuantity: returnedQty,
        remainingQuantity: remainingQty,
        canReturn: remainingQty > 0,
      };
    });

    res.json({
      success: true,
      data: {
        sale,
        items: itemsWithReturnStatus,
        existingReturns,
        daysSincePurchase: daysDiff,
        canReturn: daysDiff <= 7,
      },
    });
  } catch (error) {
    console.error('Error searching returns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search returns',
    });
  }
};

/**
 * Create return/exchange
 */
export const createReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const {
      saleId,
      quantity,
      reason,
      reasonDetails,
      isExchange,
      exchangeProductId,
      exchangeQuantity,
      notes,
    } = req.body;

    // Validation
    if (!saleId || !quantity || !reason) {
      res.status(400).json({
        success: false,
        error: 'saleId, quantity, and reason are required',
      });
      return;
    }

    if (quantity <= 0) {
      res.status(400).json({
        success: false,
        error: 'Quantity must be greater than 0',
      });
      return;
    }

    // Get sale
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: {
        product: true,
        store: true,
      },
    });

    if (!sale) {
      res.status(404).json({
        success: false,
        error: 'Sale not found',
      });
      return;
    }

    // Check 7-day return policy
    const saleDate = new Date(sale.saleDate);
    const today = new Date();
    const daysDiff = Math.floor((today.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 7) {
      res.status(400).json({
        success: false,
        error: 'Return period expired. Returns are only allowed within 7 days of purchase.',
      });
      return;
    }

    // Check if quantity exceeds available
    const existingReturns = await prisma.return.findMany({
      where: { saleId },
    });

    const totalReturned = existingReturns.reduce((sum, ret) => sum + ret.quantity, 0);
    const availableToReturn = sale.quantitySold - totalReturned;

    if (quantity > availableToReturn) {
      res.status(400).json({
        success: false,
        error: `Cannot return ${quantity} items. Only ${availableToReturn} items available for return.`,
      });
      return;
    }

    // Get original sale (receipt) - use the same sale as originalSaleId
    // Since each sale item has the same saleNumber, we use the first sale with this number as original
    const originalSale = sale; // For now, use the same sale. In future, we can track the receipt-level sale separately

    // Calculate return amount (proportional to quantity)
    const returnAmount = (Number(sale.finalAmount) * quantity) / sale.quantitySold;

    // Handle exchange
    let exchangeProduct = null;
    let exchangeAmount = 0;
    let differenceAmount = 0;

    if (isExchange && exchangeProductId && exchangeQuantity) {
      exchangeProduct = await prisma.product.findUnique({
        where: { id: exchangeProductId },
        include: {
          category: true,
        },
      });

      if (!exchangeProduct) {
        res.status(404).json({
          success: false,
          error: 'Exchange product not found',
        });
        return;
      }

      exchangeAmount = Number(exchangeProduct.salePrice || exchangeProduct.price) * exchangeQuantity;
      differenceAmount = exchangeAmount - returnAmount;
    }

    // Generate return number
    const returnNumber = await generateNextReturnNumber();

    // Create return
    const returnRecord = await prisma.return.create({
      data: {
        returnNumber,
        originalSaleId: originalSale.id,
        saleId,
        productId: sale.productId,
        quantity,
        reason: reason as ReturnReason,
        reasonDetails: reasonDetails || null,
        status: ReturnStatus.PROCESSED,
        isExchange,
        exchangeProductId: exchangeProductId || null,
        exchangeQuantity: exchangeQuantity || null,
        differenceAmount: differenceAmount !== 0 ? differenceAmount : null,
        originalAmount: Number(sale.finalAmount),
        returnAmount,
        processedById: userId,
        processedAt: new Date(),
        notes: notes || null,
      },
      include: {
        product: {
          include: {
            category: true,
          },
        },
        exchangeProduct: {
          include: {
            category: true,
          },
        },
        processedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Update inventory (add back returned items, remove exchange items if any)
    await prisma.$transaction(async (tx) => {
      // Add back returned product to inventory
      if (sale.storeId) {
        // Update store inventory
        await tx.storeProductInventory.upsert({
          where: {
            storeId_productId: {
              storeId: sale.storeId,
              productId: sale.productId,
            },
          },
          update: {
            quantity: {
              increment: quantity,
            },
          },
          create: {
            storeId: sale.storeId,
            productId: sale.productId,
            quantity: quantity,
          },
        });
      } else {
        // Update global product quantity
        await tx.product.update({
          where: { id: sale.productId },
          data: {
            quantity: {
              increment: quantity,
            },
          },
        });
      }

      // Remove exchange product from inventory if exchange
      if (isExchange && exchangeProductId && exchangeQuantity) {
        if (sale.storeId) {
          await tx.storeProductInventory.upsert({
            where: {
              storeId_productId: {
                storeId: sale.storeId,
                productId: exchangeProductId,
              },
            },
            update: {
              quantity: {
                decrement: exchangeQuantity,
              },
            },
            create: {
              storeId: sale.storeId,
              productId: exchangeProductId,
              quantity: -exchangeQuantity,
            },
          });
        } else {
          await tx.product.update({
            where: { id: exchangeProductId },
            data: {
              quantity: {
                decrement: exchangeQuantity,
              },
            },
          });
        }
      }
    });

    // Create activity log
    await createActivityLog({
      entityType: 'SALE',
      entityId: sale.id,
      entityName: `Return ${returnNumber}`,
      action: 'UPDATE',
      category: 'Returns',
      details: `Processed return for ${quantity} x ${sale.product.name}. ${isExchange ? 'Exchange' : 'Return'}`,
      userId,
      storeId: sale.storeId,
    });

    res.status(201).json({
      success: true,
      message: 'Return processed successfully',
      data: returnRecord,
    });
  } catch (error: any) {
    console.error('Error creating return:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process return',
    });
  }
};

