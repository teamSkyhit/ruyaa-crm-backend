// src/controllers/shelfController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse, Shelf } from '../types';
import { createActivityLog } from './activityController';

async function getShelves(req: Request, res: Response): Promise<void> {
  try {
    const shelves = await prisma.shelf.findMany({
      include: {
        products: {
          select: { id: true, name: true, barcode: true, quantity: true },
        },
      },
    });
    const response: ApiResponse<any[]> = { success: true, data: shelves };
    res.json(response);
  } catch (error) {
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch shelves',
    };
    res.status(500).json(response);
  }
}

async function createShelf(req: Request, res: Response): Promise<void> {
  try {
    const { id, name, description } = req.body;

    if (!id || !name) {
      res
        .status(400)
        .json({ success: false, error: 'ID and name are required' });
      return;
    }

    const shelf = await prisma.shelf.create({
      data: { id, name, description },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'SHELF',
      entityId: shelf.id,
      entityName: shelf.name,
      action: 'CREATE',
      category: 'Shelves',
      details: `Shelf created: ${shelf.name}`,
      userId: req.user?.userId,
    });

    const response: ApiResponse<Shelf> = {
      success: true,
      data: shelf,
      message: 'Shelf created successfully',
    };
    res.status(201).json(response);
  } catch (error: any) {
    let errorMessage = 'Failed to create shelf';
    if (error.code === 'P2002') {
      errorMessage = 'Shelf with this ID already exists';
    }
    const response: ApiResponse = { success: false, error: errorMessage };
    res.status(400).json(response);
  }
}

async function updateShelf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const shelf = await prisma.shelf.update({
      where: { id },
      data: { name, description },
    });

    const response: ApiResponse<Shelf> = { success: true, data: shelf };
    res.json(response);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Shelf not found' });
      return;
    }
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update shelf',
    };
    res.status(500).json(response);
  }
}

async function deleteShelf(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const shelf = await prisma.shelf.delete({ where: { id } });
    const response: ApiResponse<Shelf> = { success: true, data: shelf };
    res.json(response);
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Shelf not found' });
      return;
    }
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete shelf',
    };
    res.status(500).json(response);
  }
}

export { getShelves, createShelf, updateShelf, deleteShelf };
