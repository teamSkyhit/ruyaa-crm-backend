import prisma from '../prismaClient';
import { Order, OrderItem, Product, Prisma } from '@prisma/client';

type OrderWithItems = Order & { items: (OrderItem & { product: Product | null })[] };

type SiteVars = {
  brandName: string;
  logoHtml: string;
  socialLinksHtml: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
};

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

async function getSiteVars(): Promise<SiteVars> {
  const s = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: {
      brandName: true,
      logoUrl: true,
      contactEmail: true,
      contactPhone: true,
      address: true,
      instagramUrl: true,
      facebookUrl: true,
      youtubeUrl: true,
      pinterestUrl: true,
    },
  });

  const brand = s?.brandName || 'Ruyaa Essentials';

  const logoHtml = s?.logoUrl
    ? `<img src="${s.logoUrl}" alt="${brand}" style="max-height:48px;max-width:180px;display:inline-block"/>`
    : `<span style="color:#fff;font-size:22px;font-weight:700;letter-spacing:1px">${brand}</span>`;

  const socialIcons: string[] = [];
  if (s?.instagramUrl) socialIcons.push(`<a href="${s.instagramUrl}" style="display:inline-block;margin:0 6px"><img src="https://cdn-icons-png.flaticon.com/24/2111/2111463.png" alt="Instagram" width="24" height="24" style="vertical-align:middle"/></a>`);
  if (s?.facebookUrl) socialIcons.push(`<a href="${s.facebookUrl}" style="display:inline-block;margin:0 6px"><img src="https://cdn-icons-png.flaticon.com/24/733/733547.png" alt="Facebook" width="24" height="24" style="vertical-align:middle"/></a>`);
  if (s?.youtubeUrl) socialIcons.push(`<a href="${s.youtubeUrl}" style="display:inline-block;margin:0 6px"><img src="https://cdn-icons-png.flaticon.com/24/1384/1384060.png" alt="YouTube" width="24" height="24" style="vertical-align:middle"/></a>`);
  if (s?.pinterestUrl) socialIcons.push(`<a href="${s.pinterestUrl}" style="display:inline-block;margin:0 6px"><img src="https://cdn-icons-png.flaticon.com/24/145/145808.png" alt="Pinterest" width="24" height="24" style="vertical-align:middle"/></a>`);

  const socialLinksHtml = socialIcons.length
    ? `<div style="margin-bottom:8px">${socialIcons.join('')}</div>`
    : '';

  return {
    brandName: brand,
    logoHtml,
    socialLinksHtml,
    contactEmail: s?.contactEmail || '',
    contactPhone: s?.contactPhone || '',
    address: s?.address || '',
  };
}

async function getDbTemplate(key: string): Promise<{ subject: string; bodyHtml: string } | null> {
  const tpl = await prisma.emailTemplate.findFirst({
    where: { key, isActive: true },
  });
  return tpl ? { subject: tpl.subject, bodyHtml: tpl.bodyHtml } : null;
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

function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Supports {{var}} (HTML-escaped) and {{{var}}} (raw HTML, for pre-built HTML blocks)
function interpolate(template: string, vars: Record<string, string>, escapeHtml = true): string {
  // Triple-brace first (raw HTML, no escaping)
  let result = template.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => vars[key] ?? `{{{${key}}}}`);
  // Then double-brace (escaped for HTML bodies, plain for subjects)
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key] ?? `{{${key}}}`;
    return escapeHtml ? esc(val) : val;
  });
  return result;
}

// Standard branded email wrapper used by fallback templates
function brandedHtml(opts: SiteVars & { bodyContent: string }): string {
  const { logoHtml, socialLinksHtml, brandName, contactEmail, contactPhone, bodyContent } = opts;
  const contactLine = [contactEmail, contactPhone].filter(Boolean).join(' · ');
  return `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#2c2c2c;background:#fff">
      <div style="background:#4A5C38;padding:24px 32px;text-align:center">
        ${logoHtml}
      </div>
      <div style="padding:32px 32px 24px">
        ${bodyContent}
      </div>
      <div style="background:#f7f5f0;padding:20px 32px;text-align:center;border-top:2px solid #4A5C38">
        ${socialLinksHtml}
        <p style="margin:4px 0;font-size:13px;color:#555;font-family:sans-serif">${brandName} · Natural Handcrafted Soaps</p>
        ${contactLine ? `<p style="margin:4px 0;font-size:12px;color:#888;font-family:sans-serif">${contactLine}</p>` : ''}
      </div>
    </div>
  `.trim();
}

export async function sendOrderConfirmation(order: OrderWithItems): Promise<void> {
  const settings = await prisma.siteSettings.findUnique({
    where: { singleton: 'global' },
    select: { orderConfirmationEmailEnabled: true },
  });
  if (!settings?.orderConfirmationEmailEnabled) return;

  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('order_confirmation');

  if (dbTemplate) {
    const itemsHtml = order.items.map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #eee">${esc(item.productName)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.unitPrice)}</td>
        <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.subtotal)}</td>
      </tr>`).join('');

    const vars: Record<string, string> = {
      ...siteVars,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      total: formatCurrency(order.total),
      subtotal: formatCurrency(order.subtotal),
      shippingCharge: order.freeShippingApplied ? 'FREE' : formatCurrency(order.shippingCharge),
      itemsHtml,
    };
    await sendEmail(
      order.customerEmail,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  // Fallback hardcoded
  const itemsHtml = order.items.map((item) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${esc(item.productName)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${item.quantity}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.unitPrice)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatCurrency(item.subtotal)}</td>
    </tr>`).join('');

  const isCOD = order.paymentMethod === 'COD';
  const body = `
    <h2 style="color:#4A5C38;margin-top:0">Order Confirmed!</h2>
    <p>Hi ${esc(order.customerName)}, your order <strong>${esc(order.orderNumber)}</strong> has been ${isCOD ? 'placed' : 'confirmed'}.</p>
    ${isCOD ? '<p style="background:#fff3cd;padding:12px;border-radius:4px">Payment will be collected at the time of delivery.</p>' : ''}
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left">Product</th>
        <th style="padding:8px;text-align:center">Qty</th>
        <th style="padding:8px;text-align:right">Price</th>
        <th style="padding:8px;text-align:right">Total</th>
      </tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div style="text-align:right;margin-top:8px">
      <p>Subtotal: ${formatCurrency(order.subtotal)}</p>
      <p>Shipping: ${order.freeShippingApplied ? '<span style="color:green">FREE</span>' : formatCurrency(order.shippingCharge)}</p>
      <p><strong>Total: ${formatCurrency(order.total)}</strong></p>
    </div>
    <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
    <h3>Shipping To</h3>
    <p>${esc(order.shippingFullName)}<br/>
    ${esc(order.shippingAddressLine1)}${order.shippingAddressLine2 ? ', ' + esc(order.shippingAddressLine2) : ''}<br/>
    ${esc(order.shippingCity)}, ${esc(order.shippingState)} – ${esc(order.shippingPincode)}<br/>
    Phone: ${esc(order.shippingPhone)}</p>
    <p style="color:#666;font-size:14px">Estimated delivery: 5-7 business days. We'll send tracking details once your order ships.</p>
  `;
  await sendEmail(
    order.customerEmail,
    `Order Confirmed – ${order.orderNumber} | ${siteVars.brandName}`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendShippingUpdate(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName' | 'trackingNumber' | 'trackingUrl'>
): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('shipping_update');

  const trackingHtml = order.trackingUrl
    ? `<p><a href="${order.trackingUrl}" style="color:#4A5C38;font-weight:600">Track your shipment →</a></p>`
    : order.trackingNumber
    ? `<p>Tracking number: <strong>${esc(order.trackingNumber)}</strong></p>`
    : '';

  if (dbTemplate) {
    const vars: Record<string, string> = {
      ...siteVars,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      trackingHtml,
    };
    await sendEmail(
      order.customerEmail,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">Your order has shipped!</h2>
    <p>Hi ${esc(order.customerName)}, your order <strong>${esc(order.orderNumber)}</strong> is on its way.</p>
    ${trackingHtml}
  `;
  await sendEmail(
    order.customerEmail,
    `Your order ${order.orderNumber} has shipped!`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendNewsletterWelcome(email: string): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('newsletter_welcome');

  if (dbTemplate) {
    const vars: Record<string, string> = { ...siteVars };
    await sendEmail(
      email,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">You're on the list!</h2>
    <p>Thank you for subscribing to the ${esc(siteVars.brandName)} newsletter. You'll be the first to hear about new products, seasonal collections, and exclusive offers.</p>
    <p style="color:#666;font-size:14px">We respect your inbox — expect only meaningful updates, no spam.</p>
    <p style="color:#999;font-size:12px;margin-top:32px">If you didn't sign up for this, you can safely ignore this email.</p>
  `;
  await sendEmail(
    email,
    `Welcome to ${siteVars.brandName}!`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendDeliveryConfirmation(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName'>
): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('delivery_confirmation');

  if (dbTemplate) {
    const vars: Record<string, string> = {
      ...siteVars,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
    };
    await sendEmail(
      order.customerEmail,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">Your order has been delivered!</h2>
    <p>Hi ${esc(order.customerName)}, great news! Your order <strong>${esc(order.orderNumber)}</strong> has been delivered.</p>
    <p>We hope you love your ${esc(siteVars.brandName)} products. If you have any questions, please don't hesitate to reach out.</p>
    <p style="color:#666;font-size:14px">Thank you for shopping with us!</p>
  `;
  await sendEmail(
    order.customerEmail,
    `Your ${siteVars.brandName} order has been delivered!`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendReviewRequest(
  order: Pick<Order, 'orderNumber' | 'customerEmail' | 'customerName'>,
  items: { productName: string; productSlug: string }[],
  storefrontUrl: string
): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('review_request');

  const productLinks = items.map((item) => `
    <li style="margin-bottom:8px">
      <a href="${storefrontUrl}/products/${esc(item.productSlug)}" style="color:#4A5C38;font-weight:500">${esc(item.productName)}</a>
    </li>`).join('');

  if (dbTemplate) {
    const vars: Record<string, string> = {
      ...siteVars,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      productLinks,
    };
    await sendEmail(
      order.customerEmail,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">How did we do?</h2>
    <p>Hi ${esc(order.customerName)}, we hope you're enjoying your recent order <strong>${esc(order.orderNumber)}</strong>.</p>
    <p>Your feedback means a lot to us. Would you mind taking a moment to leave a review for the products you purchased?</p>
    <ul style="list-style:none;padding:0;margin:16px 0">${productLinks}</ul>
    <p style="color:#666;font-size:14px">It only takes a minute and helps other customers make informed choices.</p>
  `;
  await sendEmail(
    order.customerEmail,
    `How was your ${siteVars.brandName} experience?`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendNewsletterBroadcast(
  subject: string,
  html: string,
  recipients: string[]
): Promise<{ sent: number; failed: number }> {
  const { apiKey, fromEmail } = await getResendConfig();

  let sent = 0;
  let failed = 0;

  const BATCH_SIZE = 50;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    try {
      const response = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(batch.map((to) => ({ from: fromEmail, to, subject, html }))),
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
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('password_reset');

  if (dbTemplate) {
    const vars: Record<string, string> = { ...siteVars, resetUrl };
    await sendEmail(
      email,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">Reset your password</h2>
    <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
    <p style="text-align:center;margin:32px 0">
      <a href="${resetUrl}" style="background:#4A5C38;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold">Reset Password</a>
    </p>
    <p>This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
    <p style="color:#999;font-size:12px">If the button doesn't work, copy and paste this link into your browser:<br/>${esc(resetUrl)}</p>
  `;
  await sendEmail(
    email,
    `Reset your ${siteVars.brandName} password`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendOtp(email: string, otp: string): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('customer_otp');

  if (dbTemplate) {
    const vars: Record<string, string> = { ...siteVars, otp };
    await sendEmail(
      email,
      interpolate(dbTemplate.subject, vars, false),
      interpolate(dbTemplate.bodyHtml, vars, true)
    );
    return;
  }

  const body = `
    <h2 style="color:#4A5C38;margin-top:0">Your login code</h2>
    <p>Use this code to sign in. It expires in 10 minutes.</p>
    <p style="font-size:36px;letter-spacing:10px;font-weight:700;text-align:center;color:#4A5C38;margin:24px 0">${esc(otp)}</p>
    <p style="color:#666;font-size:14px">If you did not request this code, you can safely ignore this email.</p>
  `;
  await sendEmail(
    email,
    `Your ${siteVars.brandName} OTP`,
    brandedHtml({ ...siteVars, bodyContent: body })
  );
}

export async function sendLowStockAlert(
  productName: string,
  sku: string,
  currentQty: number,
  threshold: number
): Promise<void> {
  const siteVars = await getSiteVars();
  const dbTemplate = await getDbTemplate('low_stock_alert');
  const { apiKey, fromEmail } = await getResendConfig();
  const adminEmail = process.env.ADMIN_EMAIL || 'nagasatisharigela@gmail.com';

  let subject: string;
  let html: string;

  if (dbTemplate) {
    const vars: Record<string, string> = {
      ...siteVars,
      productName,
      sku,
      currentQty: String(currentQty),
      threshold: String(threshold),
    };
    subject = interpolate(dbTemplate.subject, vars, false);
    html = interpolate(dbTemplate.bodyHtml, vars, true);
  } else {
    const body = `
      <h2 style="color:#c0392b;margin-top:0">Low Stock Alert</h2>
      <p><strong>${esc(productName)}</strong> (SKU: ${esc(sku)}) is running low.</p>
      <table style="border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px 16px 8px 0;color:#666">Current stock:</td><td style="padding:8px 0;font-weight:700;color:#c0392b">${currentQty} units</td></tr>
        <tr><td style="padding:8px 16px 8px 0;color:#666">Alert threshold:</td><td style="padding:8px 0">${threshold} units</td></tr>
      </table>
      <p>Please restock soon to avoid stockouts.</p>
    `;
    subject = `Low Stock Alert: ${productName}`;
    html = brandedHtml({ ...siteVars, bodyContent: body });
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: fromEmail, to: adminEmail, subject, html }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Low stock alert email failed: ${error}`);
  }
}

export async function sendCustomerOtp(email: string, otp: string): Promise<void> {
  // Alias: same template key as sendOtp
  return sendOtp(email, otp);
}

export async function sendTicketReply(to: string, ticketNumber: string, body: string): Promise<boolean> {
  try {
    const siteVars = await getSiteVars();
    const dbTemplate = await getDbTemplate('ticket_reply');

    const safeBody = body
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    let subject: string;
    let html: string;

    if (dbTemplate) {
      const vars: Record<string, string> = {
        ...siteVars,
        ticketNumber,
        body: safeBody,
      };
      subject = interpolate(dbTemplate.subject, vars, false);
      html = interpolate(dbTemplate.bodyHtml, vars, true);
    } else {
      const bodyContent = `
        <h2 style="color:#4A5C38;margin-top:0">Reply on ticket ${esc(ticketNumber)}</h2>
        <div style="background:#f9f9f9;border-left:4px solid #4A5C38;padding:16px 20px;border-radius:0 4px 4px 0;line-height:1.7">${safeBody}</div>
        <p style="color:#888;font-size:13px;margin-top:20px">Ticket reference: ${esc(ticketNumber)}</p>
      `;
      subject = `Reply on ${ticketNumber}`;
      html = brandedHtml({ ...siteVars, bodyContent });
    }

    await sendEmail(to, subject, html);
    return true;
  } catch (error) {
    console.error('[sendTicketReply]', error);
    return false;
  }
}
