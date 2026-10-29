import crypto from 'crypto';
import prisma from '../prismaClient';

// Lazily load Razorpay credentials from SystemConfig so the admin can
// update keys from the CRM without restarting the server.
async function getCredentials(): Promise<{ keyId: string; keySecret: string }> {
  const rows = await prisma.systemConfig.findMany({
    where: { key: { in: ['razorpay_key_id', 'razorpay_key_secret'] } },
  });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  if (!map.razorpay_key_id || !map.razorpay_key_secret) {
    throw new Error('Razorpay credentials not configured. Set them in CRM → System Config.');
  }
  return { keyId: map.razorpay_key_id, keySecret: map.razorpay_key_secret };
}

export interface RazorpayOrder {
  id: string;
  amount: number; // paise
  currency: string;
  receipt: string;
}

/**
 * Create a Razorpay order.
 * amount is in rupees — converted to paise internally.
 */
export async function createRazorpayOrder(
  amountRupees: number,
  receipt: string
): Promise<RazorpayOrder> {
  const { keyId, keySecret } = await getCredentials();

  const body = JSON.stringify({
    amount: Math.round(amountRupees * 100), // paise
    currency: 'INR',
    receipt,
  });

  const credentials = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Razorpay order creation failed: ${error}`);
  }

  return response.json() as Promise<RazorpayOrder>;
}

/**
 * Verify Razorpay payment signature.
 * Returns true if the signature is valid.
 */
export async function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string
): Promise<boolean> {
  const { keySecret } = await getCredentials();
  const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(razorpaySignature)
  );
}

/**
 * Verify Razorpay webhook signature.
 * webhookSecret is stored separately in SystemConfig as 'razorpay_webhook_secret'.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const row = await prisma.systemConfig.findUnique({
    where: { key: 'razorpay_webhook_secret' },
  });
  if (!row?.value) return false;

  const expected = Buffer.from(
    crypto.createHmac('sha256', row.value).update(rawBody).digest('hex')
  );
  const provided = Buffer.from(signature);
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}
