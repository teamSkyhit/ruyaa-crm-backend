import prisma from '../prismaClient';
import { Order, OrderItem, Product, Prisma } from '@prisma/client';

type OrderWithItems = Order & { items: (OrderItem & { product: Product | null })[] };

async function getResendConfig(): Promise<{ apiKey: string; fromEmail: string }> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ['resend_api_key', 'from_email'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.resend_api_key || !map.from_email) {
    throw new Error('Resend credentials not configured. Set them in CRM → System Config.');
  }
  return { apiKey: map.resend_api_key, fromEmail: map.from_email };
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const { apiKey, fromEmail } = await getResendConfig();

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: fromEmail, to, subject, html }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Resend email failed: ${error}`);
  }
}

function formatCurrency(amount: Prisma.Decimal | number | string): string {
  return `₹${Number(amount.toString()).toFixed(2)}`;
}

export async function sendOrderConfirmation(order: OrderWithItems): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { orderConfirmationEmailEnabled: true, brandName: true },
  });

  if (!settings?.orderConfirmationEmailEnabled) return;

  const brandName = settings.brandName || 'Ruyaa Essentials';
  const itemsHtml = order.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${item.productName}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.subtotal)}</td>
      </tr>`
    )
    .join('');

  const isCOD = order.paymentMethod === 'COD';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">${brandName}</h1>
      </div>
      <div style="padding:24px">
        <h2 style="color:#4A5C38">Order Confirmed!</h2>
        <p>Hi ${order.customerName}, your order <strong>${order.orderNumber}</strong> has been ${isCOD ? 'placed' : 'confirmed'}.</p>
        ${isCOD ? '<p style="background:#fff3cd;padding:12px;border-radius:4px">Payment will be collected at the time of delivery.</p>' : ''}
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead>
            <tr style="background:#f5f5f5">
              <th style="padding:8px;text-align:left">Product</th>
              <th style="padding:8px;text-align:center">Qty</th>
              <th style="padding:8px;text-align:right">Price</th>
              <th style="padding:8px;text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
        <div style="text-align:right;margin-top:8px">
          <p>Subtotal: ${formatCurrency(order.subtotal)}</p>
          <p>Shipping: ${order.freeShippingApplied ? '<span style="color:green">FREE</span>' : formatCurrency(order.shippingCharge)}</p>
          <p><strong>Total: ${formatCurrency(order.total)}</strong></p>
        </div>
        <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
        <h3>Shipping To</h3>
        <p>
          ${order.shippingFullName}<br/>
          ${order.shippingAddressLine1}${order.shippingAddressLine2 ? ', ' + order.shippingAddressLine2 : ''}<br/>
          ${order.shippingCity}, ${order.shippingState} – ${order.shippingPincode}<br/>
          Phone: ${order.shippingPhone}
        </p>
        <p style="color:#666;font-size:14px">Estimated delivery: 5-7 business days. We'll send tracking details once your order ships.</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666">
        <p>${brandName} · Natural Handcrafted Soaps</p>
      </div>
    </div>
  `;

  await sendEmail(
    order.customerEmail,
    `Order Confirmed – ${order.orderNumber} | ${brandName}`,
    html
  );
}

export async function sendShippingUpdate(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName' | 'trackingNumber' | 'trackingUrl'>
): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { brandName: true },
  });
  const brandName = settings?.brandName || 'Ruyaa Essentials';

  const trackingHtml = order.trackingUrl
    ? `<p><a href="${order.trackingUrl}" style="color:#4A5C38">Track your shipment →</a></p>`
    : order.trackingNumber
    ? `<p>Tracking number: <strong>${order.trackingNumber}</strong></p>`
    : '';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0">${brandName}</h1>
      </div>
      <div style="padding:24px">
        <h2 style="color:#4A5C38">Your order has shipped!</h2>
        <p>Hi ${order.customerName}, your order <strong>${order.orderNumber}</strong> is on its way.</p>
        ${trackingHtml}
      </div>
    </div>
  `;

  await sendEmail(order.customerEmail, `Your order ${order.orderNumber} has shipped!`, html);
}

export async function sendNewsletterWelcome(email: string): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { brandName: true },
  });
  const brandName = settings?.brandName || 'Ruyaa Essentials';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">${brandName}</h1>
      </div>
      <div style="padding:32px 24px">
        <h2 style="color:#4A5C38;margin-top:0">You're on the list!</h2>
        <p>Thank you for subscribing to the ${brandName} newsletter. You'll be the first to hear about new products, seasonal collections, and exclusive offers.</p>
        <p style="color:#666;font-size:14px">We respect your inbox — expect only meaningful updates, no spam.</p>
        <p style="color:#999;font-size:12px;margin-top:32px">If you didn't sign up for this, you can safely ignore this email.</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666">
        <p>${brandName} · Natural Handcrafted Soaps</p>
      </div>
    </div>
  `;

  await sendEmail(email, `Welcome to ${brandName}!`, html);
}

export async function sendDeliveryConfirmation(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName'>
): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { brandName: true },
  });
  const brandName = settings?.brandName || 'Ruyaa Essentials';

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">${brandName}</h1>
      </div>
      <div style="padding:32px 24px">
        <h2 style="color:#4A5C38;margin-top:0">Your order has been delivered! 🎉</h2>
        <p>Hi ${order.customerName}, great news! Your order <strong>${order.orderNumber}</strong> has been delivered.</p>
        <p>We hope you love your ${brandName} products. If you have any questions or concerns, please don't hesitate to reach out.</p>
        <p style="color:#666;font-size:14px">Thank you for shopping with us!</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666">
        <p>${brandName} · Natural Handcrafted Soaps</p>
      </div>
    </div>
  `;

  await sendEmail(order.customerEmail, `Your ${brandName} order has been delivered!`, html);
}

export async function sendReviewRequest(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName'>,
  items: { productName: string; productSlug: string }[],
  storefrontUrl: string
): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { brandName: true },
  });
  const brandName = settings?.brandName || 'Ruyaa Essentials';

  const productLinks = items
    .map(
      (item) => `
      <li style="margin-bottom:8px">
        <a href="${storefrontUrl}/products/${item.productSlug}" style="color:#4A5C38;font-weight:500">${item.productName}</a>
      </li>`
    )
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">${brandName}</h1>
      </div>
      <div style="padding:32px 24px">
        <h2 style="color:#4A5C38;margin-top:0">How did we do?</h2>
        <p>Hi ${order.customerName}, we hope you're enjoying your recent order <strong>${order.orderNumber}</strong>.</p>
        <p>Your feedback means a lot to us. Would you mind taking a moment to leave a review for the products you purchased?</p>
        <ul style="list-style:none;padding:0;margin:16px 0">${productLinks}</ul>
        <p style="color:#666;font-size:14px">It only takes a minute and helps other customers make informed choices.</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666">
        <p>${brandName} · Natural Handcrafted Soaps</p>
      </div>
    </div>
  `;

  await sendEmail(order.customerEmail, `How was your ${brandName} experience? 🌿`, html);
}

export async function sendNewsletterBroadcast(
  subject: string,
  html: string,
  recipients: string[]
): Promise<{ sent: number; failed: number }> {
  const { apiKey, fromEmail } = await getResendConfig();

  let sent = 0;
  let failed = 0;

  // Resend allows up to 50 recipients per batch call
  const BATCH_SIZE = 50;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(
          batch.map((to) => ({ from: fromEmail, to, subject, html }))
        ),
      });
      if (response.ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
      }
    } catch {
      failed += batch.length;
    }
  }

  return { sent, failed };
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">Ruyaa Essentials</h1>
      </div>
      <div style="padding:24px">
        <h2 style="color:#4A5C38">Reset your password</h2>
        <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
        <p style="text-align:center;margin:32px 0">
          <a href="${resetUrl}" style="background:#4A5C38;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold">Reset Password</a>
        </p>
        <p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
        <p style="color:#999;font-size:12px">If the button doesn't work, copy and paste this link into your browser:<br/>${resetUrl}</p>
      </div>
      <div style="background:#f5f5f5;padding:16px;text-align:center;font-size:12px;color:#666">
        <p>Ruyaa Essentials · Natural Handcrafted Soaps</p>
      </div>
    </div>
  `;
  await sendEmail(email, 'Reset your Ruyaa Essentials password', html);
}

export async function sendCustomerOtp(email: string, otp: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#4A5C38;padding:24px;text-align:center">
        <h1 style="color:#fff;margin:0;font-size:24px">Ruyaa Essentials</h1>
      </div>
      <div style="padding:24px">
        <h2 style="color:#4A5C38">Your login code</h2>
        <p>Use this code to sign in. It expires in 10 minutes.</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;text-align:center">${otp}</p>
        <p>If you did not request this code, you can ignore this email.</p>
      </div>
    </div>
  `;
  await sendEmail(email, 'Your Ruyaa Essentials login code', html);
}

export async function sendTicketReply(to: string, ticketNumber: string, body: string): Promise<boolean> {
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  try {
    await sendEmail(
      to,
      `Reply on ${ticketNumber}`,
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333"><p>${safe}</p><p>Ticket ${ticketNumber}</p></div>`
    );
    return true;
  } catch (error) {
    console.error('[sendTicketReply]', error);
    return false;
  }
}
