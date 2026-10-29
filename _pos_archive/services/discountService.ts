/**
 * Discount Calculation Service
 * Handles item-wise discounts (percentage, fixed amount, manual)
 * Rounds to nearest rupee as per requirement
 */

export interface DiscountCalculationResult {
  originalAmount: number;
  discountPercent: number | null;
  discountAmount: number;
  finalAmount: number;
}

export interface DiscountCalculationInput {
  amount: number; // Original amount
  discountPercent?: number; // Discount percentage (5, 10, etc.)
  discountAmount?: number; // Fixed discount amount (manual discount)
  roundToNearestRupee?: boolean; // Round final amount to nearest rupee
}

/**
 * Calculate discount for an item
 * @param input - Discount calculation input
 * @returns Discount calculation result
 */
export function calculateDiscount(
  input: DiscountCalculationInput
): DiscountCalculationResult {
  const {
    amount,
    discountPercent,
    discountAmount: fixedDiscountAmount,
    roundToNearestRupee = true,
  } = input;

  let calculatedDiscountAmount = 0;
  let finalDiscountPercent: number | null = null;

  // Priority: Fixed discount amount > Percentage discount
  if (fixedDiscountAmount !== undefined && fixedDiscountAmount > 0) {
    // Manual/fixed discount
    calculatedDiscountAmount = Math.min(fixedDiscountAmount, amount); // Can't discount more than amount
    finalDiscountPercent = (calculatedDiscountAmount / amount) * 100;
  } else if (discountPercent !== undefined && discountPercent > 0) {
    // Percentage discount
    finalDiscountPercent = discountPercent;
    calculatedDiscountAmount = (amount * discountPercent) / 100;
  }

  // Round discount amount to 2 decimal places
  calculatedDiscountAmount = Math.round(calculatedDiscountAmount * 100) / 100;

  // Calculate final amount after discount
  let finalAmount = amount - calculatedDiscountAmount;

  // Round to nearest rupee if required
  if (roundToNearestRupee) {
    finalAmount = Math.round(finalAmount);
    // Recalculate discount amount to match rounded final amount
    calculatedDiscountAmount = amount - finalAmount;
  } else {
    // Round to 2 decimal places
    finalAmount = Math.round(finalAmount * 100) / 100;
  }

  return {
    originalAmount: amount,
    discountPercent: finalDiscountPercent,
    discountAmount: calculatedDiscountAmount,
    finalAmount,
  };
}

/**
 * Apply multiple discount levels (e.g., 5% then 10%)
 * @param amount - Original amount
 * @param discounts - Array of discount percentages or amounts
 * @param roundToNearestRupee - Round final amount
 * @returns Discount calculation result
 */
export function calculateCumulativeDiscount(
  amount: number,
  discounts: Array<{ percent?: number; amount?: number }>,
  roundToNearestRupee: boolean = true
): DiscountCalculationResult {
  let currentAmount = amount;
  let totalDiscountAmount = 0;

  discounts.forEach((discount) => {
    const result = calculateDiscount({
      amount: currentAmount,
      discountPercent: discount.percent,
      discountAmount: discount.amount,
      roundToNearestRupee: false, // Don't round intermediate steps
    });
    currentAmount = result.finalAmount;
    totalDiscountAmount += result.discountAmount;
  });

  // Round final amount if required
  if (roundToNearestRupee) {
    currentAmount = Math.round(currentAmount);
    totalDiscountAmount = amount - currentAmount;
  }

  const finalDiscountPercent =
    amount > 0 ? (totalDiscountAmount / amount) * 100 : 0;

  return {
    originalAmount: amount,
    discountPercent: finalDiscountPercent,
    discountAmount: totalDiscountAmount,
    finalAmount: currentAmount,
  };
}

/**
 * Validate discount input
 * @param input - Discount calculation input
 * @returns Validation error message or null if valid
 */
export function validateDiscount(input: DiscountCalculationInput): string | null {
  const { amount, discountPercent, discountAmount } = input;

  if (amount < 0) {
    return 'Amount cannot be negative';
  }

  if (discountPercent !== undefined) {
    if (discountPercent < 0 || discountPercent > 100) {
      return 'Discount percentage must be between 0 and 100';
    }
  }

  if (discountAmount !== undefined) {
    if (discountAmount < 0) {
      return 'Discount amount cannot be negative';
    }
    if (discountAmount > amount) {
      return 'Discount amount cannot exceed original amount';
    }
  }

  if (discountPercent === undefined && discountAmount === undefined) {
    return 'Either discount percentage or discount amount must be provided';
  }

  return null;
}
