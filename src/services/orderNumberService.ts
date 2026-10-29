import prisma from '../prismaClient';

const ORDER_PREFIX = 'RYA-';
const ORDER_PADDING = 6; // RYA-000001

/**
 * Generate next order number atomically.
 * Call this inside the same $transaction as the Order insert so number gaps
 * and race conditions are impossible.
 *
 * Example:
 *   const order = await prisma.$transaction(async (tx) => {
 *     const orderNumber = await generateOrderNumber(tx);
 *     return tx.order.create({ data: { orderNumber, ... } });
 *   });
 */
export async function generateOrderNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]
): Promise<string> {
  const KEY = 'order_number_seq';

  // Atomic upsert + increment via raw SQL — safe under concurrent load
  const result = await tx.$queryRaw<{ value: string }[]>`
    INSERT INTO system_config (id, key, value, "updatedAt")
    VALUES (gen_random_uuid(), ${KEY}, '1', now())
    ON CONFLICT (key)
    DO UPDATE
      SET value       = (CAST(system_config.value AS INTEGER) + 1)::TEXT,
          "updatedAt" = now()
    RETURNING value
  `;

  const seq = parseInt(result[0].value, 10);
  if (isNaN(seq)) throw new Error('Failed to read order number sequence');

  return `${ORDER_PREFIX}${seq.toString().padStart(ORDER_PADDING, '0')}`;
}
