import prisma from '../prismaClient';

const RETURN_PREFIX = 'RET-';
const RETURN_START_NUMBER = 1;
const RETURN_PADDING = 6; // 6 digits: 000001
const MAX_RETURN_RETRIES = 10; // Max retries to find a unique return number

/**
 * Generate next return number in format: RET-000001, RET-000002, etc.
 * Ensures uniqueness across all returns with a retry mechanism.
 */
export async function generateNextReturnNumber(): Promise<string> {
  try {
    let nextNumber = RETURN_START_NUMBER;
    let newReturnNumber: string;
    let retries = 0;

    while (retries < MAX_RETURN_RETRIES) {
      // Find the highest existing return number
      const lastReturn = await prisma.return.findFirst({
        where: {
          returnNumber: {
            startsWith: RETURN_PREFIX,
          },
        },
        orderBy: {
          returnNumber: 'desc',
        },
        select: {
          returnNumber: true,
        },
      });

      if (lastReturn && lastReturn.returnNumber) {
        const lastNumberStr = lastReturn.returnNumber.replace(RETURN_PREFIX, '');
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Format with padding: 1 -> "000001", 123 -> "000123"
      const paddedNumber = nextNumber.toString().padStart(RETURN_PADDING, '0');
      newReturnNumber = `${RETURN_PREFIX}${paddedNumber}`;

      // Double-check uniqueness (handle potential race conditions)
      const exists = await prisma.return.findUnique({
        where: { returnNumber: newReturnNumber },
        select: { id: true },
      });

      if (!exists) {
        return newReturnNumber; // Found a unique return number
      }

      nextNumber++; // Increment and try again
      retries++;
    }

    throw new Error('Failed to generate a unique return number after multiple retries.');
  } catch (error) {
    console.error('Error generating return number:', error);
    throw new Error('Failed to generate return number');
  }
}

/**
 * Validate return number format
 * @param returnNumber - Return number to validate
 * @returns true if valid format (RET-000001)
 */
export function validateReturnNumber(returnNumber: string): boolean {
  if (!returnNumber) return false;
  
  const pattern = /^RET-\d{6}$/;
  return pattern.test(returnNumber);
}

