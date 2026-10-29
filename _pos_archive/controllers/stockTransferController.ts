// src/controllers/stockTransferController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { generateNextTransferNumber } from '../services/transferNumberService';
import { createActivityLog } from './activityController';

/**
 * Get all stock transfers (with filters)
 */
export const getAllStockTransfers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId, status, productId } = req.query;

    const where: any = {};
    if (storeId) {
      where.OR = [
        { fromStoreId: storeId as string },
        { toStoreId: storeId as string },
      ];
    }
    if (status) {
      where.status = status as string;
    }
    if (productId) {
      where.productId = productId as string;
    }

    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            barcode: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        shippedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        receivedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    res.json({
      success: true,
      data: transfers,
    });
  } catch (error) {
    console.error('Error fetching stock transfers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock transfers',
    });
  }
};

/**
 * Get stock transfer by ID
 */
export const getStockTransferById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        product: {
          include: {
            category: true,
          },
        },
        requestedBy: true,
        approvedBy: true,
        shippedBy: true,
        receivedBy: true,
      },
    });

    if (!transfer) {
      res.status(404).json({
        success: false,
        message: 'Stock transfer not found',
      });
      return;
    }

    res.json({
      success: true,
      data: transfer,
    });
  } catch (error) {
    console.error('Error fetching stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stock transfer',
    });
  }
};

/**
 * Request a stock transfer
 */
export const requestStockTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fromStoreId, toStoreId, productId, quantity, notes } = req.body;

    // Validate stores are different
    if (fromStoreId === toStoreId) {
      res.status(400).json({
        success: false,
        message: 'Source and destination stores must be different',
      });
      return;
    }

    // Validate stores exist
    const [fromStore, toStore] = await Promise.all([
      prisma.store.findUnique({ where: { id: fromStoreId } }),
      prisma.store.findUnique({ where: { id: toStoreId } }),
    ]);

    if (!fromStore || !toStore) {
      res.status(404).json({
        success: false,
        message: 'One or both stores not found',
      });
      return;
    }

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        category: true,
      },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    // Check source store inventory
    const sourceInventory = await prisma.storeProductInventory.findUnique({
      where: {
        storeId_productId: {
          storeId: fromStoreId,
          productId,
        },
      },
    });

    const availableQuantity = sourceInventory
      ? sourceInventory.quantity - sourceInventory.reservedQty
      : 0;

    if (availableQuantity < quantity) {
      res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${availableQuantity}, Requested: ${quantity}`,
      });
      return;
    }

    // Generate transfer number
    const transferNumber = await generateNextTransferNumber();

    // Create transfer request
    const transfer = await prisma.stockTransfer.create({
      data: {
        transferNumber,
        fromStoreId,
        toStoreId,
        productId,
        quantity,
        status: 'PENDING',
        notes: notes || null,
        requestedById: req.user?.userId || null,
      },
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Reserve quantity in source store inventory
    if (sourceInventory) {
      await prisma.storeProductInventory.update({
        where: {
          storeId_productId: {
            storeId: fromStoreId,
            productId,
          },
        },
        data: {
          reservedQty: sourceInventory.reservedQty + quantity,
        },
      });
    } else {
      // Create inventory record with reserved quantity
      await prisma.storeProductInventory.create({
        data: {
          storeId: fromStoreId,
          productId,
          quantity: 0,
          reservedQty: quantity,
        },
      });
    }

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: productId,
      entityName: product.name,
      action: 'CREATE',
      details: `Stock transfer requested: ${quantity} units from ${fromStore.name} to ${toStore.name}`,
      userId: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      data: transfer,
      message: 'Stock transfer requested successfully',
    });
  } catch (error) {
    console.error('Error requesting stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to request stock transfer',
    });
  }
};

/**
 * Approve a stock transfer
 */
export const approveStockTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        product: true,
      },
    });

    if (!transfer) {
      res.status(404).json({
        success: false,
        message: 'Stock transfer not found',
      });
      return;
    }

    if (transfer.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Transfer cannot be approved. Current status: ${transfer.status}`,
      });
      return;
    }

    // Update transfer status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: 'IN_TRANSIT',
        approvedById: req.user?.userId || null,
        approvedAt: new Date(),
      },
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: transfer.productId,
      entityName: transfer.product.name,
      action: 'UPDATE',
      details: `Stock transfer approved: ${transfer.transferNumber}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: updatedTransfer,
      message: 'Stock transfer approved successfully',
    });
  } catch (error) {
    console.error('Error approving stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve stock transfer',
    });
  }
};

/**
 * Ship stock transfer (mark as shipped)
 */
export const shipStockTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        product: true,
      },
    });

    if (!transfer) {
      res.status(404).json({
        success: false,
        message: 'Stock transfer not found',
      });
      return;
    }

    if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Transfer cannot be shipped. Current status: ${transfer.status}`,
      });
      return;
    }

    // Get source store inventory
    const sourceInventory = await prisma.storeProductInventory.findUnique({
      where: {
        storeId_productId: {
          storeId: transfer.fromStoreId,
          productId: transfer.productId,
        },
      },
    });

    if (!sourceInventory || sourceInventory.quantity < transfer.quantity) {
      res.status(400).json({
        success: false,
        message: 'Insufficient stock to ship',
      });
      return;
    }

    // Deduct quantity from source store and reduce reserved quantity
    await prisma.storeProductInventory.update({
      where: {
        storeId_productId: {
          storeId: transfer.fromStoreId,
          productId: transfer.productId,
        },
      },
      data: {
        quantity: sourceInventory.quantity - transfer.quantity,
        reservedQty: Math.max(0, sourceInventory.reservedQty - transfer.quantity),
      },
    });

    // Update transfer status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: 'IN_TRANSIT',
        shippedById: req.user?.userId || null,
        shippedAt: new Date(),
        // Auto-approve if still pending
        approvedById: transfer.approvedById || req.user?.userId || null,
        approvedAt: transfer.approvedAt || new Date(),
      },
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: transfer.productId,
      entityName: transfer.product.name,
      action: 'UPDATE',
      details: `Stock transfer shipped: ${transfer.transferNumber} - ${transfer.quantity} units`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: updatedTransfer,
      message: 'Stock transfer shipped successfully',
    });
  } catch (error) {
    console.error('Error shipping stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to ship stock transfer',
    });
  }
};

/**
 * Receive stock transfer
 */
export const receiveStockTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        product: true,
      },
    });

    if (!transfer) {
      res.status(404).json({
        success: false,
        message: 'Stock transfer not found',
      });
      return;
    }

    if (transfer.status !== 'IN_TRANSIT') {
      res.status(400).json({
        success: false,
        message: `Transfer cannot be received. Current status: ${transfer.status}`,
      });
      return;
    }

    // Get or create destination store inventory
    const destInventory = await prisma.storeProductInventory.findUnique({
      where: {
        storeId_productId: {
          storeId: transfer.toStoreId,
          productId: transfer.productId,
        },
      },
    });

    if (destInventory) {
      // Add quantity to existing inventory
      await prisma.storeProductInventory.update({
        where: {
          storeId_productId: {
            storeId: transfer.toStoreId,
            productId: transfer.productId,
          },
        },
        data: {
          quantity: destInventory.quantity + transfer.quantity,
        },
      });
    } else {
      // Create new inventory record
      await prisma.storeProductInventory.create({
        data: {
          storeId: transfer.toStoreId,
          productId: transfer.productId,
          quantity: transfer.quantity,
          reservedQty: 0,
        },
      });
    }

    // Update transfer status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: 'RECEIVED',
        receivedById: req.user?.userId || null,
        receivedAt: new Date(),
      },
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: transfer.productId,
      entityName: transfer.product.name,
      action: 'UPDATE',
      details: `Stock transfer received: ${transfer.transferNumber} - ${transfer.quantity} units at ${transfer.toStore.name}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: updatedTransfer,
      message: 'Stock transfer received successfully',
    });
  } catch (error) {
    console.error('Error receiving stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to receive stock transfer',
    });
  }
};

/**
 * Cancel a stock transfer
 */
export const cancelStockTransfer = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const transfer = await prisma.stockTransfer.findUnique({
      where: { id },
      include: {
        fromStore: true,
        toStore: true,
        product: true,
      },
    });

    if (!transfer) {
      res.status(404).json({
        success: false,
        message: 'Stock transfer not found',
      });
      return;
    }

    if (transfer.status === 'RECEIVED' || transfer.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: `Transfer cannot be cancelled. Current status: ${transfer.status}`,
      });
      return;
    }

    // If transfer was pending or in transit, release reserved quantity
    if (transfer.status === 'PENDING' || transfer.status === 'IN_TRANSIT') {
      const sourceInventory = await prisma.storeProductInventory.findUnique({
        where: {
          storeId_productId: {
            storeId: transfer.fromStoreId,
            productId: transfer.productId,
          },
        },
      });

      if (sourceInventory && sourceInventory.reservedQty >= transfer.quantity) {
        await prisma.storeProductInventory.update({
          where: {
            storeId_productId: {
              storeId: transfer.fromStoreId,
              productId: transfer.productId,
            },
          },
          data: {
            reservedQty: sourceInventory.reservedQty - transfer.quantity,
          },
        });
      }
    }

    // Update transfer status
    const updatedTransfer = await prisma.stockTransfer.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        fromStore: {
          select: {
            id: true,
            name: true,
          },
        },
        toStore: {
          select: {
            id: true,
            name: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: transfer.productId,
      entityName: transfer.product.name,
      action: 'DELETE',
      details: `Stock transfer cancelled: ${transfer.transferNumber}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: updatedTransfer,
      message: 'Stock transfer cancelled successfully',
    });
  } catch (error) {
    console.error('Error cancelling stock transfer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel stock transfer',
    });
  }
};

