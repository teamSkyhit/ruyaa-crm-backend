// eslint-disable-next-line @typescript-eslint/no-require-imports
const htmlPdf = require('html-pdf-node') as {
  generatePdf: (
    file: { content: string },
    options: { format: string }
  ) => Promise<Buffer>;
};

import prisma from '../prismaClient';
import { Prisma } from '@prisma/client';

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatMoney(val: Prisma.Decimal | number | string): string {
  return `₹${Number(val.toString()).toFixed(2)}`;
}

function buildInvoiceHtml(order: {
  orderNumber: string;
  createdAt: Date;
  status: string;
  customerName: string;
  customerEmail: string;
  shippingFullName: string;
  shippingAddressLine1: string;
  shippingAddressLine2?: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  total: Prisma.Decimal | number | string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: Prisma.Decimal | number | string;
    subtotal: Prisma.Decimal | number | string;
    variant?: { name: string } | null;
  }>;
}): string {
  const items = order.items
    .map(
      (i) => `
    <tr>
      <td>${esc(i.productName)}${i.variant ? ` (${esc(i.variant.name)})` : ''}</td>
      <td>${esc(i.quantity)}</td>
      <td>${formatMoney(i.unitPrice)}</td>
      <td>${formatMoney(i.subtotal)}</td>
    </tr>`
    )
    .join('');

  const addr2 = order.shippingAddressLine2 ? `, ${esc(order.shippingAddressLine2)}` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; color: #333; padding: 40px; }
  h1 { color: #4A5C38; }
  .logo { font-size: 24px; font-weight: bold; color: #4A5C38; }
  .tagline { color: #888; font-style: italic; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  th { background: #4A5C38; color: white; padding: 8px; text-align: left; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .total-row td { font-weight: bold; border-top: 2px solid #4A5C38; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .address { background: #f9f9f9; padding: 10px; border-radius: 4px; }
</style>
</head>
<body>
  <div class="logo">Ruyaa Essentials</div>
  <div class="tagline">Pure radiance, naturally.</div>
  <h2>Invoice</h2>
  <div class="meta">
    <div>
      <strong>Order #:</strong> ${esc(order.orderNumber)}<br>
      <strong>Date:</strong> ${esc(new Date(order.createdAt).toLocaleDateString('en-IN'))}<br>
      <strong>Status:</strong> ${esc(order.status)}
    </div>
    <div class="address">
      <strong>Ship To:</strong><br>
      ${esc(order.shippingFullName)}<br>
      ${esc(order.shippingAddressLine1)}${addr2}<br>
      ${esc(order.shippingCity)}, ${esc(order.shippingState)} ${esc(order.shippingPincode)}<br>
      ${esc(order.customerEmail)}
    </div>
  </div>
  <table>
    <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
    <tbody>
      ${items}
      <tr class="total-row">
        <td colspan="3">Total</td>
        <td>${formatMoney(order.total)}</td>
      </tr>
    </tbody>
  </table>
  <p style="margin-top:40px;color:#888;font-size:12px;">Thank you for shopping with Ruyaa Essentials. This is a computer-generated invoice.</p>
</body>
</html>`;
}

export async function generateInvoicePdf(orderId: string): Promise<{ buffer: Buffer; orderNumber: string }> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          variant: { select: { name: true } },
        },
      },
    },
  });
  if (!order) throw new Error('Order not found');

  const html = buildInvoiceHtml(order);
  const buffer = await htmlPdf.generatePdf({ content: html }, { format: 'A4' });
  return { buffer, orderNumber: order.orderNumber };
}
