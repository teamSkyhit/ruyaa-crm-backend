// src/services/skuService.ts
import prisma from '../prismaClient';

const SKU_PREFIX = 'RYA-';
const SKU_START_NUMBER = 1;
const SKU_PADDING = 3; // 3 digits: 001

/**
 * Generate next SKU in format: GPS-000001, GPS-000002, etc.
 * Ensures uniqueness across all products
 */
export async function generateNextSKU(): Promise<string> {
  try {
    // Find the highest existing SKU number
    const lastProduct = await prisma.product.findFirst({
      where: {
        sku: {
          startsWith: SKU_PREFIX,
        },
      },
      orderBy: {
        sku: 'desc',
      },
      select: {
        sku: true,
      },
    });

    let nextNumber = SKU_START_NUMBER;

    if (lastProduct && lastProduct.sku) {
      // Extract number from last SKU (e.g., "GPS-000123" -> 123)
      const lastNumberStr = lastProduct.sku.replace(SKU_PREFIX, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Try to find a unique SKU (handle race conditions)
    const maxRetries = 100;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Format with padding: 1 -> "000001", 123 -> "000123"
      const paddedNumber = (nextNumber + attempt).toString().padStart(SKU_PADDING, '0');
      const newSKU = `${SKU_PREFIX}${paddedNumber}`;

      // Check uniqueness
      const exists = await prisma.product.findUnique({
        where: { sku: newSKU },
        select: { id: true },
      });

      if (!exists) {
        return newSKU;
      }
    }

    throw new Error('Failed to generate unique SKU after multiple attempts');
  } catch (error) {
    console.error('Error generating SKU:', error);
    throw new Error('Failed to generate SKU');
  }
}

/**
 * Validate SKU format
 * @param sku - SKU to validate
 * @returns true if valid format (GPS-000001)
 */
export function validateSKU(sku: string): boolean {
  if (!sku) return false;
  
  const pattern = /^RYA-\d{3}$/;
  return pattern.test(sku);
}

/**
 * Generate multiple SKUs at once (for batch creation)
 * @param count - Number of SKUs to generate
 * @returns Array of unique SKUs
 */
export async function generateMultipleSKUs(count: number): Promise<string[]> {
  try {
    if (count < 1) {
      throw new Error('Count must be at least 1');
    }

    // Find the highest existing SKU number
    const lastProduct = await prisma.product.findFirst({
      where: {
        sku: {
          startsWith: SKU_PREFIX,
        },
      },
      orderBy: {
        sku: 'desc',
      },
      select: {
        sku: true,
      },
    });

    let nextNumber = SKU_START_NUMBER;

    if (lastProduct && lastProduct.sku) {
      // Extract number from last SKU (e.g., "GPS-000123" -> 123)
      const lastNumberStr = lastProduct.sku.replace(SKU_PREFIX, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Generate multiple SKUs sequentially
    const skus: string[] = [];
    let currentNumber = nextNumber;
    let attempt = 0;
    const maxAttempts = 1000; // Higher limit for batch generation

    while (skus.length < count && attempt < maxAttempts) {
      const paddedNumber = currentNumber.toString().padStart(SKU_PADDING, '0');
      const newSKU = `${SKU_PREFIX}${paddedNumber}`;

      // Check uniqueness
      const exists = await prisma.product.findUnique({
        where: { sku: newSKU },
        select: { id: true },
      });

      if (!exists) {
        skus.push(newSKU);
        currentNumber++;
      } else {
        currentNumber++;
      }
      attempt++;
    }

    if (skus.length < count) {
      throw new Error(`Failed to generate ${count} unique SKUs after ${maxAttempts} attempts`);
    }

    return skus;
  } catch (error) {
    console.error('Error generating multiple SKUs:', error);
    throw new Error('Failed to generate SKUs');
  }
}

/**
 * Check if SKU exists
 * @param sku - SKU to check
 * @returns true if SKU exists
 */
export async function skuExists(sku: string): Promise<boolean> {
  try {
    const product = await prisma.product.findUnique({
      where: { sku },
      select: { id: true },
    });
    return !!product;
  } catch (error) {
    console.error('Error checking SKU existence:', error);
    return false;
  }
}

