import { Decimal } from '@prisma/client/runtime/library';

/**
 * GST Calculation Service
 * Handles GST calculations based on category-level rates
 * Supports GST-inclusive and GST-exclusive pricing
 * Calculates CGST/SGST/IGST based on store location
 */

export interface GSTCalculationResult {
  taxableAmount: number;
  gstRate: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  finalAmount: number;
}

export interface GSTCalculationInput {
  amount: number; // Taxable amount (after discounts)
  gstRate: number; // GST rate (0, 5, 12, 18)
  gstInclusive: boolean; // Whether price includes GST
  isInterState?: boolean; // Whether sale is inter-state (for IGST)
}

/**
 * Calculate GST for a given amount
 * @param input - GST calculation input parameters
 * @returns GST calculation result
 */
export function calculateGST(input: GSTCalculationInput): GSTCalculationResult {
  const { amount, gstRate, gstInclusive, isInterState = false } = input;

  let taxableAmount: number;
  let gstAmount: number;
  let finalAmount: number;

  if (gstInclusive) {
    // Price includes GST - extract taxable amount
    // taxableAmount = amount / (1 + gstRate/100)
    // gstAmount = amount - taxableAmount
    const rateMultiplier = 1 + gstRate / 100;
    taxableAmount = amount / rateMultiplier;
    gstAmount = amount - taxableAmount;
    finalAmount = amount; // Final amount is same as input (GST inclusive)
  } else {
    // Price excludes GST - add GST to amount
    taxableAmount = amount;
    gstAmount = (amount * gstRate) / 100;
    finalAmount = amount + gstAmount;
  }

  // Round to 2 decimal places
  taxableAmount = Math.round(taxableAmount * 100) / 100;
  gstAmount = Math.round(gstAmount * 100) / 100;
  finalAmount = Math.round(finalAmount * 100) / 100;

  // Calculate CGST/SGST/IGST
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterState) {
    // Inter-state: Use IGST (full GST rate)
    igstAmount = gstAmount;
  } else {
    // Intra-state: Split into CGST and SGST (half each).
    // BUG-008 FIX: Round cgst to 2dp, derive sgst as the remainder — guarantees
    // cgstAmount + sgstAmount === gstAmount exactly, even for odd-paise amounts.
    cgstAmount = Math.round((gstAmount / 2) * 100) / 100;
    sgstAmount = Math.round((gstAmount - cgstAmount) * 100) / 100;
  }

  return {
    taxableAmount,
    gstRate,
    gstAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    finalAmount,
  };
}

/**
 * Calculate GST for multiple items (for a complete sale)
 * @param items - Array of items with GST calculation inputs
 * @param isInterState - Whether sale is inter-state
 * @returns Aggregated GST calculation result
 */
export function calculateGSTForSale(
  items: Array<{
    amount: number;
    gstRate: number;
    gstInclusive: boolean;
  }>,
  isInterState: boolean = false
): GSTCalculationResult {
  let totalTaxableAmount = 0;
  let totalGstAmount = 0;
  let totalCgstAmount = 0;
  let totalSgstAmount = 0;
  let totalIgstAmount = 0;
  let totalFinalAmount = 0;

  items.forEach((item) => {
    const result = calculateGST({
      ...item,
      isInterState,
    });

    totalTaxableAmount += result.taxableAmount;
    totalGstAmount += result.gstAmount;
    totalCgstAmount += result.cgstAmount;
    totalSgstAmount += result.sgstAmount;
    totalIgstAmount += result.igstAmount;
    totalFinalAmount += result.finalAmount;
  });

  // Round totals
  totalTaxableAmount = Math.round(totalTaxableAmount * 100) / 100;
  totalGstAmount = Math.round(totalGstAmount * 100) / 100;
  totalFinalAmount = Math.round(totalFinalAmount * 100) / 100;

  // BUG-008 FIX: Derive cgst/sgst/igst totals using the subtraction approach so that
  // totalCgstAmount + totalSgstAmount === totalGstAmount exactly (no 1-paise diff).
  // Independent rounding of both halves after float accumulation can cause off-by-one.
  if (isInterState) {
    totalIgstAmount = totalGstAmount;
    totalCgstAmount = 0;
    totalSgstAmount = 0;
  } else {
    totalIgstAmount = 0;
    // Round cgst to 2dp, then derive sgst as the remainder to guarantee exact sum
    totalCgstAmount = Math.round((totalGstAmount / 2) * 100) / 100;
    totalSgstAmount = Math.round((totalGstAmount - totalCgstAmount) * 100) / 100;
  }

  // Determine average GST rate (weighted average)
  const avgGstRate =
    totalTaxableAmount > 0
      ? Math.round((totalGstAmount / totalTaxableAmount) * 100 * 100) / 100
      : 0;

  return {
    taxableAmount: totalTaxableAmount,
    gstRate: avgGstRate,
    gstAmount: totalGstAmount,
    cgstAmount: totalCgstAmount,
    sgstAmount: totalSgstAmount,
    igstAmount: totalIgstAmount,
    finalAmount: totalFinalAmount,
  };
}

/**
 * Convert GST rate value to a number.
 * Handles Prisma Decimal objects, numeric strings ("18", "18.00"), and legacy enum strings (ZERO, FIVE, etc.)
 * @param gstRateValue - GST rate in any supported format
 * @returns Numeric GST rate (0, 5, 12, 18, etc.)
 */
export function gstRateEnumToNumber(gstRateValue: any): number {
  if (gstRateValue == null) return 0;

  // Handle Prisma Decimal or plain number
  const num = Number(gstRateValue);
  if (!isNaN(num)) return num;

  // Handle legacy enum strings
  const enumMap: Record<string, number> = {
    ZERO: 0,
    FIVE: 5,
    TWELVE: 12,
    EIGHTEEN: 18,
  };
  return enumMap[String(gstRateValue)] || 0;
}

/**
 * Check if sale is inter-state (different store states)
 * @param storeState - State of the store
 * @param customerState - State of the customer (optional)
 * @returns true if inter-state sale
 */
export function isInterStateSale(storeState?: string, customerState?: string): boolean {
  if (!storeState || !customerState) {
    return false; // Default to intra-state if states not provided
  }
  return storeState.trim().toUpperCase() !== customerState.trim().toUpperCase();
}
