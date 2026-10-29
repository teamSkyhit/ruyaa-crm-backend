import crypto from 'crypto';
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { getShiprocketConfig } from '../services/integrationConfig';
import { applyCourierUpdate } from '../services/shiprocketService';

function readString(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
}

export async function handleShiprocketWebhook(req: Request, res: Response): Promise<void> {
  const config = await getShiprocketConfig();
  if (!config.webhookToken) {
    res.status(503).json({ success: false, error: 'Shiprocket webhook token is not configured' });
    return;
  }

  const provided = req.get('x-api-key') || '';
  const expected = Buffer.from(config.webhookToken);
  const actual = Buffer.from(provided);
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    res.status(401).json({ success: false, error: 'Invalid webhook token' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const status = readString(body.current_status || body.shipment_status || body.status);
  const awb = readString(body.awb);
  const orderNumber = readString(body.order_id);
  const courierName = readString(body.courier_name);
  const timestamp = readString(body.current_timestamp);
  if (!status || (!awb && !orderNumber)) {
    res.status(400).json({ success: false, error: 'status and awb or order_id are required' });
    return;
  }

  const eventId = `shiprocket:${orderNumber}:${awb}:${status}:${timestamp}`.slice(0, 100);
  const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
  if (existing) {
    res.json({ success: true, applied: false });
    return;
  }

  const result = await applyCourierUpdate({ orderNumber: orderNumber || undefined, awb: awb || undefined, status, courierName });
  await prisma.webhookEvent.create({
    data: { provider: 'shiprocket', eventId, payload: body as object },
  });
  res.json({ success: true, applied: result.applied });
}
