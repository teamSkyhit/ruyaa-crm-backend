// src/controllers/storeController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { createActivityLog } from './activityController';

/**
 * Get all stores
 */
export const getAllStores = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: {
            counters: true,
            users: true,
            sales: true,
          },
        },
      },
    });

    res.json({
      success: true,
      data: stores,
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stores',
    });
  }
};

/**
 * Get store by ID
 */
export const getStoreById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        counters: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        },
        _count: {
          select: {
            sales: true,
            storeInventories: true,
          },
        },
      },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    res.json({
      success: true,
      data: store,
    });
  } catch (error) {
    console.error('Error fetching store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch store',
    });
  }
};

/**
 * Create a new store
 */
export const createStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const {
      name,
      code,
      gstin,
      address,
      city,
      state,
      pincode,
      contact,
      email,
      website,
      logoUrl,
      isActive,
    } = req.body;

    // Check if store name already exists
    const existingStore = await prisma.store.findUnique({
      where: { name },
    });

    if (existingStore) {
      res.status(400).json({
        success: false,
        message: 'Store with this name already exists',
      });
      return;
    }

    // Check if code already exists (if provided)
    if (code) {
      const existingCode = await prisma.store.findUnique({
        where: { code },
      });

      if (existingCode) {
        res.status(400).json({
          success: false,
          message: 'Store with this code already exists',
        });
        return;
      }
    }

    const store = await prisma.store.create({
      data: {
        name,
        code: code || null,
        gstin: gstin || null,
        address: address || null,
        city: city || null,
        state: state || null,
        pincode: pincode || null,
        contact: contact || null,
        email: email || null,
        website: website || null,
        logoUrl: logoUrl || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT', // Using PRODUCT as placeholder, might need STORE entity type
      entityId: store.id,
      entityName: store.name,
      action: 'CREATE',
      details: `Store created: ${store.name}`,
      userId: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      data: store,
      message: 'Store created successfully',
    });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create store',
    });
  }
};

/**
 * Update a store
 */
export const updateStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      gstin,
      address,
      city,
      state,
      pincode,
      contact,
      email,
      website,
      logoUrl,
      isActive,
    } = req.body;

    // Check if store exists
    const existingStore = await prisma.store.findUnique({
      where: { id },
    });

    if (!existingStore) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    // Check if name is being changed and if new name already exists
    if (name && name !== existingStore.name) {
      const nameExists = await prisma.store.findUnique({
        where: { name },
      });

      if (nameExists) {
        res.status(400).json({
          success: false,
          message: 'Store with this name already exists',
        });
        return;
      }
    }

    // Check if code is being changed and if new code already exists
    if (code && code !== existingStore.code) {
      const codeExists = await prisma.store.findUnique({
        where: { code },
      });

      if (codeExists) {
        res.status(400).json({
          success: false,
          message: 'Store with this code already exists',
        });
        return;
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code || null;
    if (gstin !== undefined) updateData.gstin = gstin || null;
    if (address !== undefined) updateData.address = address || null;
    if (city !== undefined) updateData.city = city || null;
    if (state !== undefined) updateData.state = state || null;
    if (pincode !== undefined) updateData.pincode = pincode || null;
    if (contact !== undefined) updateData.contact = contact || null;
    if (email !== undefined) updateData.email = email || null;
    if (website !== undefined) updateData.website = website || null;
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const store = await prisma.store.update({
      where: { id },
      data: updateData,
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: store.id,
      entityName: store.name,
      action: 'UPDATE',
      details: `Store updated: ${store.name}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      data: store,
      message: 'Store updated successfully',
    });
  } catch (error) {
    console.error('Error updating store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update store',
    });
  }
};

/**
 * Delete a store
 */
export const deleteStore = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if store exists
    const store = await prisma.store.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            sales: true,
            counters: true,
            users: true,
          },
        },
      },
    });

    if (!store) {
      res.status(404).json({
        success: false,
        message: 'Store not found',
      });
      return;
    }

    // Prevent deletion if store has sales, counters, or users
    if (store._count.sales > 0 || store._count.counters > 0 || store._count.users > 0) {
      res.status(400).json({
        success: false,
        message: 'Cannot delete store with existing sales, counters, or users. Deactivate it instead.',
      });
      return;
    }

    await prisma.store.delete({
      where: { id },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: id,
      entityName: store.name,
      action: 'DELETE',
      details: `Store deleted: ${store.name}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Store deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete store',
    });
  }
};

