// src/jobs/autoCancelOrders.ts
import prisma from '../prismaClient';
import { OrderStatus } from '@prisma/client';

/**
 * Auto-cancel expired orders
 * Run this job periodically (e.g., every 15 minutes)
 */
export async function autoCancelExpiredOrders() {
  try {
    const now = new Date();

    // Find all expired sale rows (DRAFT or HANDED_OFF) with their product + store context
    const expiredSales = await prisma.sale.findMany({
      where: {
        orderStatus: { in: [OrderStatus.DRAFT, OrderStatus.HANDED_OFF] },
        expiresAt: { lte: now },
      },
      select: {
        id: true,
        floorOrderRef: true,
        productId: true,
        storeId: true,
        quantitySold: true,
      },
    });

    if (expiredSales.length === 0) {
      return { cancelled: 0, message: 'No expired orders found' };
    }

    // Group by floorOrderRef so we cancel all items of an order atomically
    const groupedByRef = new Map<string, typeof expiredSales>();
    for (const sale of expiredSales) {
      const ref = sale.floorOrderRef ?? sale.id; // fallback to saleId if no ref
      if (!groupedByRef.has(ref)) groupedByRef.set(ref, []);
      groupedByRef.get(ref)!.push(sale);
    }

    let cancelledCount = 0;

    for (const [orderRef, items] of groupedByRef) {
      await prisma.$transaction(async (tx) => {
        // 1. Cancel the sale rows
        await tx.sale.updateMany({
          where: {
            floorOrderRef: orderRef,
            orderStatus: { in: [OrderStatus.DRAFT, OrderStatus.HANDED_OFF] },
          },
          data: { orderStatus: OrderStatus.CANCELLED },
        });

        // BUG-004 FIX: Restore reservedQty for each cancelled item.
        // reservedQty was incremented when the order was handed off
        // (if StoreSettings.reserveStockOnHandoff = true).
        // We decrement it here so the reserved count doesn't become a ghost.
        for (const item of items) {
          await tx.storeProductInventory.updateMany({
            where: {
              storeId: item.storeId,
              productId: item.productId,
              reservedQty: { gt: 0 }, // only decrement if actually reserved
            },
            data: {
              reservedQty: { decrement: item.quantitySold },
            },
          });
        }

        cancelledCount += items.length;
      });
    }

    console.log(`Auto-cancelled ${cancelledCount} expired order items (reservedQty restored)`);

    return {
      cancelled: cancelledCount,
      message: `Cancelled ${cancelledCount} expired order items`,
    };
  } catch (error) {
    console.error('Error in auto-cancel expired orders job:', error);
    return { cancelled: 0, message: 'Job failed - see error log' };
  }
}

/**
 * Schedule the job (call this from your server startup)
 */
export function scheduleAutoCancelJob() {
  // Run every 5 minutes (floor orders expire after 30 min, check frequently)
  const interval = 5 * 60 * 1000; // 5 minutes in milliseconds

  setInterval(async () => {
    try {
      await autoCancelExpiredOrders();
    } catch (error) {
      console.error('Auto-cancel job error:', error);
    }
  }, interval);

  // Run after a short delay on startup (gives migrations time to complete)
  setTimeout(() => {
    autoCancelExpiredOrders().catch((err) => {
      console.warn('[AUTO-CANCEL] Initial run failed (migration may not be applied yet):', err.message);
    });
  }, 5000);

  console.log('Auto-cancel expired orders job scheduled (runs every 5 minutes)');
}
