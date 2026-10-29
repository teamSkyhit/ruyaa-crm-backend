import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { clearIntegrationConfigCache } from '../services/integrationConfig';
import { clearShiprocketAuthCache } from '../services/shiprocketService';

const ALLOWED_KEYS = new Set([
  'razorpay_key_id',
  'razorpay_key_secret',
  'razorpay_webhook_secret',
  'resend_api_key',
  'from_email',
  'order_number_seq',
  'shiprocket_email',
  'shiprocket_password',
  'shiprocket_pickup_pincode',
  'shiprocket_pickup_location',
  'shiprocket_channel_id',
  'shiprocket_webhook_token',
  'whatsapp_api_key',
  'whatsapp_base_url',
]);

const SECRET_PATTERN = /secret|key|password/i;

function maskValue(key: string, value: string): string {
  if (SECRET_PATTERN.test(key)) {
    return value.length > 0 ? '••••••••' : '';
  }
  return value;
}

export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const rows = await prisma.systemConfig.findMany({
      orderBy: { key: 'asc' },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const keys = [...new Set([...ALLOWED_KEYS, ...byKey.keys()])].sort();

    const data = keys.map((key) => {
      const row = byKey.get(key);
      return {
        key,
        value: maskValue(key, row?.value ?? ''),
        updatedAt: row?.updatedAt ?? null,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    console.error('[SYSTEM_CONFIG] getConfig error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

export async function setConfig(req: Request, res: Response): Promise<void> {
  try {
    const { key } = req.params;
    const { value } = req.body;

    if (!ALLOWED_KEYS.has(key)) {
      res.status(400).json({ success: false, error: `Unknown config key: ${key}` });
      return;
    }

    if (typeof value !== 'string') {
      res.status(400).json({ success: false, error: 'value must be a string' });
      return;
    }
    if (value === '••••••••') {
      res.status(400).json({ success: false, error: 'Enter a new value. The masked value is not saved.' });
      return;
    }

    await prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    clearIntegrationConfigCache();
    clearShiprocketAuthCache();

    res.json({ success: true, data: { key, value: maskValue(key, value) } });
  } catch (err) {
    console.error('[SYSTEM_CONFIG] setConfig error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}
