/**
 * Seeds all 9 email templates into the EmailTemplate table.
 * Each template uses {{var}} for escaped text and {{{var}}} for raw HTML blocks.
 * Site-level vars (logoHtml, socialLinksHtml, brandName, contactEmail, contactPhone)
 * are injected at send-time by resendService.getSiteVars().
 *
 * Run: npx ts-node --project tsconfig.json prisma/seed-email-templates.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Shared footer snippet used in every fallback template
const FOOTER = `
      <div style="background:#f7f5f0;padding:20px 32px;text-align:center;border-top:2px solid #4A5C38">
        {{{socialLinksHtml}}}
        <p style="margin:4px 0;font-size:13px;color:#555;font-family:sans-serif">{{brandName}} · Natural Handcrafted Soaps</p>
        <p style="margin:4px 0;font-size:12px;color:#888;font-family:sans-serif">{{contactEmail}}</p>
      </div>`.trim();

// Shared header snippet
const HEADER = `
      <div style="background:#4A5C38;padding:24px 32px;text-align:center">
        {{{logoHtml}}}
      </div>`.trim();

function wrap(body: string): string {
  return `<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#2c2c2c;background:#fff">
  ${HEADER}
  <div style="padding:32px 32px 24px">
    ${body.trim()}
  </div>
  ${FOOTER}
</div>`;
}

const templates = [
  {
    key: 'order_confirmation',
    name: 'Order Confirmation',
    subject: 'Order Confirmed – {{orderNumber}} | {{brandName}}',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Order Confirmed!</h2>
    <p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> has been confirmed.</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="background:#f5f5f5">
        <th style="padding:8px;text-align:left;font-family:sans-serif;font-size:13px">Product</th>
        <th style="padding:8px;text-align:center;font-family:sans-serif;font-size:13px">Qty</th>
        <th style="padding:8px;text-align:right;font-family:sans-serif;font-size:13px">Price</th>
        <th style="padding:8px;text-align:right;font-family:sans-serif;font-size:13px">Total</th>
      </tr></thead>
      <tbody>{{{itemsHtml}}}</tbody>
    </table>
    <div style="text-align:right;margin-top:8px;font-family:sans-serif;font-size:14px">
      <p style="margin:4px 0">Subtotal: {{subtotal}}</p>
      <p style="margin:4px 0">Shipping: {{shippingCharge}}</p>
      <p style="margin:4px 0;font-weight:700;font-size:16px">Total: {{total}}</p>
    </div>
    <p style="color:#666;font-size:13px;font-family:sans-serif;margin-top:20px">Estimated delivery: 5–7 business days. We'll send tracking details once your order ships.</p>
    <p style="color:#999;font-size:12px;font-family:sans-serif">Questions? Reply to this email or contact us at {{contactEmail}}.</p>`),
    variables: ['orderNumber', 'customerName', 'total', 'subtotal', 'shippingCharge', 'itemsHtml', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'shipping_update',
    name: 'Shipping Update',
    subject: 'Your order {{orderNumber}} has shipped! | {{brandName}}',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Your order has shipped!</h2>
    <p>Hi {{customerName}}, your order <strong>{{orderNumber}}</strong> is on its way.</p>
    {{{trackingHtml}}}
    <p style="color:#666;font-size:13px;font-family:sans-serif">If you have any questions about your delivery, please reach out at {{contactEmail}}.</p>`),
    variables: ['orderNumber', 'customerName', 'trackingHtml', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'delivery_confirmation',
    name: 'Delivery Confirmation',
    subject: 'Your {{brandName}} order has been delivered!',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Your order has been delivered!</h2>
    <p>Hi {{customerName}}, great news! Your order <strong>{{orderNumber}}</strong> has been delivered.</p>
    <p>We hope you love your {{brandName}} products. Every bar is handcrafted with care, and we hope it shows.</p>
    <p style="color:#666;font-size:13px;font-family:sans-serif">Thank you for shopping with us! If anything isn't right, contact us at {{contactEmail}} and we'll make it right.</p>`),
    variables: ['orderNumber', 'customerName', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'review_request',
    name: 'Review Request',
    subject: 'How was your {{brandName}} experience? 🌿',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">How did we do?</h2>
    <p>Hi {{customerName}}, we hope you're enjoying your recent order <strong>{{orderNumber}}</strong>.</p>
    <p>Your feedback means the world to us. Would you mind leaving a quick review for the products you purchased?</p>
    <ul style="list-style:none;padding:0;margin:16px 0">{{{productLinks}}}</ul>
    <p style="color:#666;font-size:13px;font-family:sans-serif">It only takes a minute and helps other customers discover great products.</p>`),
    variables: ['orderNumber', 'customerName', 'productLinks', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'newsletter_welcome',
    name: 'Newsletter Welcome',
    subject: 'Welcome to {{brandName}}! 🌿',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">You're on the list!</h2>
    <p>Thank you for subscribing to the {{brandName}} newsletter. You'll be the first to hear about new products, seasonal collections, and exclusive offers.</p>
    <p style="color:#666;font-size:14px;font-family:sans-serif">We respect your inbox — expect only meaningful updates, no spam.</p>
    <p style="color:#999;font-size:12px;font-family:sans-serif;margin-top:32px">If you didn't sign up for this, you can safely ignore this email.</p>`),
    variables: ['brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'password_reset',
    name: 'Password Reset',
    subject: 'Reset your {{brandName}} password',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Reset your password</h2>
    <p>We received a request to reset the password for your account. Click the button below to choose a new password.</p>
    <p style="text-align:center;margin:32px 0">
      <a href="{{resetUrl}}" style="background:#4A5C38;color:#fff;padding:14px 28px;border-radius:4px;text-decoration:none;font-weight:700;font-family:sans-serif;font-size:15px">Reset Password</a>
    </p>
    <p style="font-family:sans-serif;font-size:14px">This link expires in 1 hour. If you did not request a password reset, you can ignore this email.</p>
    <p style="color:#999;font-size:12px;font-family:sans-serif">If the button doesn't work, copy and paste this link into your browser:<br/>{{resetUrl}}</p>`),
    variables: ['resetUrl', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'customer_otp',
    name: 'Customer OTP / Login Code',
    subject: 'Your {{brandName}} login code',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Your login code</h2>
    <p style="font-family:sans-serif;font-size:15px">Use this one-time code to sign in. It expires in <strong>10 minutes</strong>.</p>
    <p style="font-size:42px;letter-spacing:14px;font-weight:700;text-align:center;color:#4A5C38;margin:28px 0;font-family:monospace">{{otp}}</p>
    <p style="color:#666;font-size:13px;font-family:sans-serif">If you did not request this code, you can safely ignore this email.</p>`),
    variables: ['otp', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'ticket_reply',
    name: 'Support Ticket Reply',
    subject: 'Reply on ticket {{ticketNumber}} | {{brandName}}',
    bodyHtml: wrap(`
    <h2 style="color:#4A5C38;margin-top:0">Reply on ticket {{ticketNumber}}</h2>
    <div style="background:#f9f9f9;border-left:4px solid #4A5C38;padding:16px 20px;border-radius:0 4px 4px 0;line-height:1.8;font-family:sans-serif;font-size:14px">{{{body}}}</div>
    <p style="color:#888;font-size:12px;font-family:sans-serif;margin-top:20px">Ticket reference: {{ticketNumber}}</p>
    <p style="color:#666;font-size:13px;font-family:sans-serif">Reply to this email to continue the conversation.</p>`),
    variables: ['ticketNumber', 'body', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
  {
    key: 'low_stock_alert',
    name: 'Low Stock Alert',
    subject: 'Low Stock Alert: {{productName}} | {{brandName}}',
    bodyHtml: wrap(`
    <h2 style="color:#c0392b;margin-top:0">Low Stock Alert</h2>
    <p style="font-family:sans-serif"><strong>{{productName}}</strong> (SKU: {{sku}}) is running low and may need restocking.</p>
    <table style="border-collapse:collapse;margin:16px 0;font-family:sans-serif;font-size:14px">
      <tr>
        <td style="padding:8px 20px 8px 0;color:#666">Current stock:</td>
        <td style="padding:8px 0;font-weight:700;color:#c0392b">{{currentQty}} units</td>
      </tr>
      <tr>
        <td style="padding:8px 20px 8px 0;color:#666">Alert threshold:</td>
        <td style="padding:8px 0">{{threshold}} units</td>
      </tr>
    </table>
    <p style="color:#666;font-size:13px;font-family:sans-serif">Please restock soon to avoid stockouts and lost sales.</p>`),
    variables: ['productName', 'sku', 'currentQty', 'threshold', 'brandName', 'logoHtml', 'socialLinksHtml', 'contactEmail'],
  },
];

async function main() {
  console.log('Seeding email templates...\n');

  for (const tpl of templates) {
    const result = await prisma.emailTemplate.upsert({
      where: { key: tpl.key },
      update: {
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        variables: tpl.variables,
        isActive: true,
      },
      create: {
        key: tpl.key,
        name: tpl.name,
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        variables: tpl.variables,
        isActive: true,
      },
    });
    console.log(`  ✓ ${result.key} — "${result.name}"`);
  }

  console.log(`\nDone. ${templates.length} templates upserted.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
