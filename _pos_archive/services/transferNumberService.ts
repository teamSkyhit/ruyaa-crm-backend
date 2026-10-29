// src/services/transferNumberService.ts
import prisma from '../prismaClient';

const TRANSFER_PREFIX = 'TRF-';
const TRANSFER_START_NUMBER = 1;
const TRANSFER_PADDING = 6; // 6 digits: 000001

/**
 * Generate next transfer number in format: TRF-000001, TRF-000002, etc.
 * Ensures uniqueness across all stock transfers
 */
export async function generateNextTransferNumber(): Promise<string> {
  try {
    // Find the highest existing transfer number
    const lastTransfer = await prisma.stockTransfer.findFirst({
      where: {
        transferNumber: {
          startsWith: TRANSFER_PREFIX,
        },
      },
      orderBy: {
        transferNumber: 'desc',
      },
      select: {
        transferNumber: true,
      },
    });

    let nextNumber = TRANSFER_START_NUMBER;

    if (lastTransfer && lastTransfer.transferNumber) {
      // Extract number from last transfer (e.g., "TRF-000123" -> 123)
      const lastNumberStr = lastTransfer.transferNumber.replace(TRANSFER_PREFIX, '');
      const lastNumber = parseInt(lastNumberStr, 10);
      
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    // Try to find a unique transfer number (handle race conditions)
    const maxRetries = 100;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Format with padding: 1 -> "000001", 123 -> "000123"
      const paddedNumber = (nextNumber + attempt).toString().padStart(TRANSFER_PADDING, '0');
      const newTransferNumber = `${TRANSFER_PREFIX}${paddedNumber}`;

      // Check uniqueness
      const exists = await prisma.stockTransfer.findUnique({
        where: { transferNumber: newTransferNumber },
        select: { id: true },
      });

      if (!exists) {
        return newTransferNumber;
      }
    }

    throw new Error('Failed to generate unique transfer number after multiple attempts');
  } catch (error) {
    console.error('Error generating transfer number:', error);
    throw new Error('Failed to generate transfer number');
  }
}

/**
 * Validate transfer number format
 * @param transferNumber - Transfer number to validate
 * @returns true if valid format (TRF-000001)
 */
export function validateTransferNumber(transferNumber: string): boolean {
  if (!transferNumber) return false;
  
  const pattern = /^TRF-\d{6}$/;
  return pattern.test(transferNumber);
}

