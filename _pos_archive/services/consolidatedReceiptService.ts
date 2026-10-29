// src/services/consolidatedReceiptService.ts
import prisma from '../prismaClient';

const CONSOLIDATED_RECEIPT_PREFIX = 'GPS-';
const CONSOLIDATED_RECEIPT_PADDING = 6; // 6 digits: 000001

/**
 * Generate next consolidated receipt number in format: GPS-000001, GPS-000002, etc.
 * Uses PostgreSQL advisory lock to prevent race conditions.
 */
export async function generateNextConsolidatedReceiptNumber(): Promise<string> {
  const LOCK_KEY = 100003; // Unique advisory lock ID for consolidated receipts

  const result = await prisma.$transaction(async (tx) => {
    // Acquire advisory lock (released when transaction commits)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})::text`;

    // Find the highest existing consolidated receipt number
    const lastSale = await tx.sale.findFirst({
      where: {
        consolidatedReceiptNumber: { startsWith: CONSOLIDATED_RECEIPT_PREFIX },
      },
      orderBy: { consolidatedReceiptNumber: 'desc' },
      select: { consolidatedReceiptNumber: true },
    });

    let nextNumber = 1;
    if (lastSale?.consolidatedReceiptNumber) {
      const lastNumberStr = lastSale.consolidatedReceiptNumber.replace(CONSOLIDATED_RECEIPT_PREFIX, '');
      const parsed = parseInt(lastNumberStr, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const paddedNumber = nextNumber.toString().padStart(CONSOLIDATED_RECEIPT_PADDING, '0');
    return `${CONSOLIDATED_RECEIPT_PREFIX}${paddedNumber}`;
  });

  return result;
}

/**
 * Validate consolidated receipt number format
 */
export function validateConsolidatedReceiptNumber(receiptNumber: string): boolean {
  if (!receiptNumber) return false;
  const pattern = /^GPS-\d{6}$/;
  return pattern.test(receiptNumber);
}
