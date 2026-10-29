import prisma from '../prismaClient';

const RECEIPT_PREFIX = 'RCP-';
const RECEIPT_PADDING = 6; // 6 digits: 000001

/**
 * Generate next receipt number in format: RCP-000001, RCP-000002, etc.
 * Uses PostgreSQL advisory lock to prevent race conditions across concurrent requests/instances.
 */
export async function generateNextReceiptNumber(): Promise<string> {
  const LOCK_KEY = 100001; // Unique advisory lock ID for receipt numbers

  const result = await prisma.$transaction(async (tx) => {
    // Acquire advisory lock (released when transaction commits)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})::text`;

    // Find the highest existing receipt number
    const lastSale = await tx.sale.findFirst({
      where: {
        saleNumber: { startsWith: RECEIPT_PREFIX },
      },
      orderBy: { saleNumber: 'desc' },
      select: { saleNumber: true },
    });

    let nextNumber = 1;
    if (lastSale?.saleNumber) {
      const lastNumberStr = lastSale.saleNumber.replace(RECEIPT_PREFIX, '');
      const parsed = parseInt(lastNumberStr, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const paddedNumber = nextNumber.toString().padStart(RECEIPT_PADDING, '0');
    return `${RECEIPT_PREFIX}${paddedNumber}`;
  });

  return result;
}

/**
 * Validate receipt number format
 * @param receiptNumber - Receipt number to validate
 * @returns true if valid format (RCP-000001)
 */
export function validateReceiptNumber(receiptNumber: string): boolean {
  if (!receiptNumber) return false;
  const pattern = /^RCP-\d{6}$/;
  return pattern.test(receiptNumber);
}
