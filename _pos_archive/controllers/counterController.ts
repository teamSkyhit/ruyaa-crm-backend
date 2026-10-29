// src/controllers/counterController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { createActivityLog } from './activityController';

/**
 * Get all counters (optionally filtered by store)
 */
export const getAllCounters = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { storeId } = req.query;

    const where: any = {};
    if (storeId) {
      where.storeId = storeId as string;
    }

    const counters = await prisma.counter.findMany({
      where,
      include: {
        store: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
      orderBy: [
        { store: { name: 'asc' } },
        { name: 'asc' },
      ],
    });

    res.json({
      success: true,
      data: counters,
    });
  } catch (error) {
    console.error('Error fetching counters:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch counters',
    });
  }
};

/**
 * Get counter by ID
 */
export const getCounterById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const counter = await prisma.counter.findUnique({
      where: { id },
      include: {
        store: true,
        _count: {
          select: {
            sales: true,
          },
        },
      },
    });

    if (!counter) {
      res.status(404).json({
        success: false,
        message: 'Counter not found',
      });
      return;
    }

    res.json({
      success: true,
      data: counter,
    });
  } catch (error) {
    console.error('Error fetching counter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch counter',
    });
  }
};

/**
 * Create a new counter
 */
export const createCounter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { name, storeId, counterType } = req.body;

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

    // Check if counter name already exists for this store
    const existingCounter = await prisma.counter.findUnique({
      where: {
        name_storeId: {
          name,
          storeId,
        },
      },
    });

    if (existingCounter) {
      res.status(400).json({
        success: false,
        message: 'Counter with this name already exists in this store',
      });
      return;
    }

    const counter = await prisma.counter.create({
      data: {
        name,
        storeId,
        ...(counterType ? { counterType } : {}),
      },
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: counter.id,
      entityName: counter.name,
      action: 'CREATE',
      details: `Counter created: ${counter.name} in store ${store.name}`,
      userId: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      data: counter,
      message: 'Counter created successfully',
    });
  } catch (error) {
    console.error('Error creating counter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create counter',
    });
  }
};

/**
 * Update a counter
 */
export const updateCounter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, storeId, counterType } = req.body;

    // Check if counter exists
    const existingCounter = await prisma.counter.findUnique({
      where: { id },
    });

    if (!existingCounter) {
      res.status(404).json({
        success: false,
        message: 'Counter not found',
      });
      return;
    }

    // If name is being changed, check uniqueness
    if (name && name !== existingCounter.name) {
      const targetStoreId = storeId || existingCounter.storeId;
      const nameExists = await prisma.counter.findUnique({
        where: {
          name_storeId: {
            name,
            storeId: targetStoreId,
          },
        },
      });

      if (nameExists && nameExists.id !== id) {
        res.status(400).json({
          success: false,
          message: 'Counter with this name already exists in this store',
        });
        return;
      }
    }

    // If storeId is being changed, validate new store exists
    if (storeId && storeId !== existingCounter.storeId) {
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
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (storeId !== undefined) updateData.storeId = storeId;
    if (counterType !== undefined) updateData.counterType = counterType;

    const counter = await prisma.counter.update({
      where: { id },
      data: updateData,
      include: {
        store: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: counter.id,
      entityName: counter.name,
      action: 'UPDATE',
      details: `Counter updated: ${counter.name}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: counter,
      message: 'Counter updated successfully',
    });
  } catch (error) {
    console.error('Error updating counter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update counter',
    });
  }
};

/**
 * Delete a counter
 */
export const deleteCounter = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if counter exists
    const counter = await prisma.counter.findUnique({
      where: { id },
      include: {
        store: {
          select: {
            name: true,
          },
        },
        _count: {
          select: {
            sales: true,
          },
        },
      },
    });

    if (!counter) {
      res.status(404).json({
        success: false,
        message: 'Counter not found',
      });
      return;
    }

    // Prevent deletion if counter has sales
    if (counter._count.sales > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete counter with existing sales',
      });
      return;
    }

    await prisma.counter.delete({
      where: { id },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: id,
      entityName: counter.name,
      action: 'DELETE',
      details: `Counter deleted: ${counter.name}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Counter deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting counter:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete counter',
    });
  }
};

