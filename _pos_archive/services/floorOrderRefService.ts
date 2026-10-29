// src/services/floorOrderRefService.ts
import prisma from '../prismaClient';

const FLOOR_ORDER_PREFIX = 'REF-';
const FLOOR_ORDER_PADDING = 4; // 4 digits: 0001, 0002, etc.

/**
 * Generate next floor order reference in format: REF-0001, REF-0002, etc.
 * Uses PostgreSQL advisory lock to prevent race conditions.
 */
export async function generateNextFloorOrderRef(): Promise<string> {
  const LOCK_KEY = 100002; // Unique advisory lock ID for floor order refs

  const result = await prisma.$transaction(async (tx) => {
    // Acquire advisory lock (released when transaction commits)
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK_KEY})::text`;

    // Find the highest existing floor order reference
    const lastSale = await tx.sale.findFirst({
      where: {
        floorOrderRef: { startsWith: FLOOR_ORDER_PREFIX },
      },
      orderBy: { floorOrderRef: 'desc' },
      select: { floorOrderRef: true },
    });

    let nextNumber = 1;
    if (lastSale?.floorOrderRef) {
      const lastNumberStr = lastSale.floorOrderRef.replace(FLOOR_ORDER_PREFIX, '');
      const parsed = parseInt(lastNumberStr, 10);
      if (!isNaN(parsed)) {
        nextNumber = parsed + 1;
      }
    }

    const paddedNumber = nextNumber.toString().padStart(FLOOR_ORDER_PADDING, '0');
    return `${FLOOR_ORDER_PREFIX}${paddedNumber}`;
  });

  return result;
}

/**
 * Validate floor order reference format
 */
export function validateFloorOrderRef(ref: string): boolean {
  if (!ref) return false;
  const pattern = /^REF-\d{4,}$/; // Allow 4+ digits for future growth
  return pattern.test(ref);
}
