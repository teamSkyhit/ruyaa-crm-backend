import { NotificationType } from '@prisma/client';
import prisma from '../prismaClient';

const DEDUPED = new Set<NotificationType>([
  NotificationType.NEW_ORDER,
  NotificationType.PAYMENT_FAILED,
  NotificationType.SHIPMENT_FAILED,
  NotificationType.LOW_STOCK,
]);

export async function notify(input: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}): Promise<void> {
  try {
    if (DEDUPED.has(input.type) && input.link) {
      const recent = await prisma.adminNotification.findFirst({
        where: {
          type: input.type,
          link: input.link,
          createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) },
        },
        select: { id: true },
      });
      if (recent) return;
    }
    await prisma.adminNotification.create({
      data: {
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link ?? null,
      },
    });
  } catch (error) {
    console.error('[notify]', error);
  }
}

export async function notifyLowStockForOrder(orderId: string): Promise<void> {
  const items = await prisma.orderItem.findMany({
    where: { orderId },
    select: { productId: true, variantId: true },
  });
  const productIds = [...new Set(items.filter((item) => !item.variantId).map((item) => item.productId).filter((id): id is string => Boolean(id)))];
  const variantIds = [...new Set(items.map((item) => item.variantId).filter((id): id is string => Boolean(id)))];

  if (productIds.length) {
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, quantity: true, lowStockThreshold: true },
    });
    for (const product of products) {
      if (product.quantity <= product.lowStockThreshold) {
        await notify({
          type: NotificationType.LOW_STOCK,
          title: `${product.name} is low on stock`,
          body: `${product.quantity} left. The threshold is ${product.lowStockThreshold}.`,
          link: `/products/${product.id}`,
        });
      }
    }
  }

  if (variantIds.length) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        name: true,
        quantity: true,
        product: { select: { id: true, name: true, lowStockThreshold: true } },
      },
    });
    for (const variant of variants) {
      if (variant.quantity <= variant.product.lowStockThreshold) {
        await notify({
          type: NotificationType.LOW_STOCK,
          title: `${variant.product.name} ${variant.name} is low on stock`,
          body: `${variant.quantity} left. The threshold is ${variant.product.lowStockThreshold}.`,
          link: `/products/${variant.product.id}#weight-${variant.id}`,
        });
      }
    }
  }
}
