// src/controllers/productAttributeController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { createActivityLog } from './activityController';

/**
 * Get all attributes for a product
 */
export const getProductAttributes = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    const attributes = await prisma.productAttribute.findMany({
      where: { productId },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: attributes,
    });
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product attributes',
    });
  }
};

/**
 * Create a new product attribute
 */
export const createProductAttribute = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId } = req.params;
    const { size, weight, price } = req.body;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    // Validate that at least size or weight is provided
    if (!size && weight === undefined) {
      res.status(400).json({
        success: false,
        message: 'Either size or weight must be provided',
      });
      return;
    }

    const attribute = await prisma.productAttribute.create({
      data: {
        productId,
        size: size || null,
        weight: weight !== undefined ? Number(weight) : null,
        price: price !== undefined ? Number(price) : null,
      },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: productId,
      entityName: product.name,
      action: 'UPDATE',
      category: product.category.name,
      details: `Product attribute added: ${size || weight || 'N/A'}`,
      userId: req.user?.userId,
    });

    res.status(201).json({
      success: true,
      data: attribute,
      message: 'Product attribute created successfully',
    });
  } catch (error) {
    console.error('Error creating product attribute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create product attribute',
    });
  }
};

/**
 * Update a product attribute
 */
export const updateProductAttribute = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId, id } = req.params;
    const { size, weight, price } = req.body;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    // Verify attribute exists and belongs to product
    const existingAttribute = await prisma.productAttribute.findUnique({
      where: { id },
    });

    if (!existingAttribute || existingAttribute.productId !== productId) {
      res.status(404).json({
        success: false,
        message: 'Product attribute not found',
      });
      return;
    }

    // Build update data
    const updateData: any = {};
    if (size !== undefined) updateData.size = size || null;
    if (weight !== undefined) updateData.weight = weight !== null ? Number(weight) : null;
    if (price !== undefined) updateData.price = price !== null ? Number(price) : null;

    const attribute = await prisma.productAttribute.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: attribute,
      message: 'Product attribute updated successfully',
    });
  } catch (error) {
    console.error('Error updating product attribute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product attribute',
    });
  }
};

/**
 * Delete a product attribute
 */
export const deleteProductAttribute = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { productId, id } = req.params;

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: { category: true },
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: 'Product not found',
      });
      return;
    }

    // Verify attribute exists and belongs to product
    const existingAttribute = await prisma.productAttribute.findUnique({
      where: { id },
    });

    if (!existingAttribute || existingAttribute.productId !== productId) {
      res.status(404).json({
        success: false,
        message: 'Product attribute not found',
      });
      return;
    }

    await prisma.productAttribute.delete({
      where: { id },
    });

    // Create activity log
    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: productId,
      entityName: product.name,
      action: 'UPDATE',
      category: product.category.name,
      details: `Product attribute deleted: ${existingAttribute.size || existingAttribute.weight || 'N/A'}`,
      userId: req.user?.userId,
    });

    res.json({
      success: true,
      message: 'Product attribute deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete product attribute',
    });
  }
};

