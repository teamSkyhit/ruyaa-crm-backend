import prisma from '../prismaClient';

const SHIFT_PREFIX = 'SHF-';
const SHIFT_START_NUMBER = 1;
const SHIFT_PADDING = 6; // 6 digits: 000001
const MAX_SHIFT_RETRIES = 10; // Max retries to find a unique shift number

/**
 * Generate next shift number in format: SHF-000001, SHF-000002, etc.
 * Ensures uniqueness across all shifts with a retry mechanism.
 */
export async function generateNextShiftNumber(): Promise<string> {
  try {
    let nextNumber = SHIFT_START_NUMBER;
    let newShiftNumber: string;
    let retries = 0;

    while (retries < MAX_SHIFT_RETRIES) {
      // Find the highest existing shift number
      const lastShift = await prisma.shift.findFirst({
        where: {
          shiftNumber: {
            startsWith: SHIFT_PREFIX,
          },
        },
        orderBy: {
          shiftNumber: 'desc',
        },
        select: {
          shiftNumber: true,
        },
      });

      if (lastShift && lastShift.shiftNumber) {
        const lastNumberStr = lastShift.shiftNumber.replace(SHIFT_PREFIX, '');
        const lastNumber = parseInt(lastNumberStr, 10);
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1;
        }
      }

      // Format with padding: 1 -> "000001", 123 -> "000123"
      const paddedNumber = nextNumber.toString().padStart(SHIFT_PADDING, '0');
      newShiftNumber = `${SHIFT_PREFIX}${paddedNumber}`;

      // Double-check uniqueness (handle potential race conditions)
      const exists = await prisma.shift.findUnique({
        where: { shiftNumber: newShiftNumber },
        select: { id: true },
      });

      if (!exists) {
        return newShiftNumber; // Found a unique shift number
      }

      nextNumber++; // Increment and try again
      retries++;
    }

    throw new Error('Failed to generate a unique shift number after multiple retries.');
  } catch (error) {
    console.error('Error generating shift number:', error);
    throw new Error('Failed to generate shift number');
  }
}

/**
 * Validate shift number format
 * @param shiftNumber - Shift number to validate
 * @returns true if valid format (SHF-000001)
 */
export function validateShiftNumber(shiftNumber: string): boolean {
  if (!shiftNumber) return false;
  
  const pattern = /^SHF-\d{6}$/;
  return pattern.test(shiftNumber);
}

