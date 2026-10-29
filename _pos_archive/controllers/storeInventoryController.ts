// src/controllers/storeInventoryController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';

/**
 * Get inventory for a specific store
 */
export const getStoreInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { lowStock } = req.query;

    // Validate store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    const where: any = {
      storeId,
    };

    // Filter low stock if requested
    if (lowStock === 'true') {
      const inventories = await prisma.storeProductInventory.findMany({
        where: { storeId },
        include: {
          product: {
            include: {
              category: true,
            },
          },
        },
      });

      // Filter for low stock (quantity < minStockLevel or category default)
      const lowStockItems = inventories.filter((inv) => {
        const minLevel = inv.minStockLevel || inv.product.category.minStockLevel;
        return inv.quantity < minLevel;
      });

      res.json({
        success: true,
        data: lowStockItems,
      });
      return;
    }

    const inventory = await prisma.storeProductInventory.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
            subcategory: true,
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    });

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error('Error fetching store inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store inventory',
    });
  }
};

/**
 * Get inventory for a specific product across all stores
 */
export const getProductInventoryAcrossStores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    const inventory = await prisma.storeProductInventory.findMany({
      where: { productId },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
            isActive: true,
          },
        },
      },
      orderBy: {
        store: {
          name: 'asc',
        },
      },
    });

    res.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error('Error fetching product inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product inventory',
    });
  }
};

/**
 * Update store inventory (manual adjustment)
 */
export const updateStoreInventory = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId, productId } = req.params;
    const { quantity, minStockLevel } = req.body;

    // Validate store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    // Validate product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    // Get or create inventory record
    const existingInventory = await prisma.storeProductInventory.findUnique({
      where: {
        storeId_productId: {
          storeId,
          productId,
        },
      },
    });

    let inventory;
    if (existingInventory) {
      const updateData: any = {};
      if (quantity !== undefined) updateData.quantity = quantity;
      if (minStockLevel !== undefined) updateData.minStockLevel = minStockLevel || null;

      inventory = await prisma.storeProductInventory.update({
        where: {
          storeId_productId: {
            storeId,
            productId,
          },
        },
        data: updateData,
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
    } else {
      inventory = await prisma.storeProductInventory.create({
        data: {
          storeId,
          productId,
          quantity: quantity || 0,
          minStockLevel: minStockLevel || null,
          reservedQty: 0,
        },
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
    }

    res.json({
      success: true,
      data: inventory,
      message: 'Store inventory updated successfully',
    });
  } catch (error) {
    console.error('Error updating store inventory:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update store inventory',
    });
  }
};

/**
 * Get inventory summary for a store
 */
export const getStoreInventorySummary = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId } = req.params;

    // Validate store exists
    const store = await prisma.store.findUnique({
      where: { id: storeId },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    const inventory = await prisma.storeProductInventory.findMany({
      where: { storeId },
      include: {
        product: {
          include: {
            category: true,
          },
        },
      },
    });

    // Calculate summary
    const totalProducts = inventory.length;
    const totalQuantity = inventory.reduce((sum, inv) => sum + inv.quantity, 0);
    const lowStockCount = inventory.filter((inv) => {
      const minLevel = inv.minStockLevel || inv.product.category.minStockLevel;
      return inv.quantity < minLevel;
    }).length;
    const outOfStockCount = inventory.filter((inv) => inv.quantity === 0).length;

    // Calculate total value (quantity * price)
    const totalValue = inventory.reduce((sum, inv) => {
      return sum + (inv.quantity * Number(inv.product.price || 0));
    }, 0);

    res.json({
      success: true,
      data: {
        store: {
          id: store.id,
          name: store.name,
          code: store.code,
        },
        summary: {
          totalProducts,
          totalQuantity,
          totalValue,
          lowStockCount,
          outOfStockCount,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching store inventory summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store inventory summary',
    });
  }
};

