import prisma from '../prismaClient';

const KEYS = [
  'shiprocket_email',
  'shiprocket_password',
  'shiprocket_pickup_pincode',
  'shiprocket_pickup_location',
  'shiprocket_channel_id',
  'shiprocket_webhook_token',
  'whatsapp_api_key',
  'whatsapp_base_url',
] as const;

type Key = (typeof KEYS)[number];

let cache: { at: number; values: Partial<Record<Key, string>> } | null = null;

export function clearIntegrationConfigCache(): void {
  cache = null;
}

async function load(): Promise<Partial<Record<Key, string>>> {
  if (cache && Date.now() - cache.at < 30_000) return cache.values;
  const rows = await prisma.systemConfig.findMany({ where: { key: { in: [...KEYS] } } });
  const values: Partial<Record<Key, string>> = {};
  for (const row of rows) values[row.key as Key] = row.value;
  cache = { at: Date.now(), values };
  return values;
}

function pick(saved: string | undefined, envValue: string | undefined): string {
  const fromDb = saved?.trim();
  if (fromDb) return fromDb;
  return envValue?.trim() || '';
}

export async function getShiprocketConfig(): Promise<{
  email: string;
  password: string;
  pickupPincode: string;
  pickupLocation: string;
  channelId: string;
  webhookToken: string;
}> {
  const saved = await load();
  return {
    email: pick(saved.shiprocket_email, process.env.SHIPROCKET_EMAIL),
    password: pick(saved.shiprocket_password, process.env.SHIPROCKET_PASSWORD),
    pickupPincode: pick(saved.shiprocket_pickup_pincode, process.env.SHIPROCKET_PICKUP_PINCODE),
    pickupLocation: pick(saved.shiprocket_pickup_location, process.env.SHIPROCKET_PICKUP_LOCATION),
    channelId: pick(saved.shiprocket_channel_id, process.env.SHIPROCKET_CHANNEL_ID),
    webhookToken: pick(saved.shiprocket_webhook_token, process.env.SHIPROCKET_WEBHOOK_TOKEN),
  };
}

export async function getWhatsappConfig(): Promise<{ apiKey: string; baseUrl: string } | null> {
  const saved = await load();
  const apiKey = pick(saved.whatsapp_api_key, process.env.WHATSAPP_API_KEY);
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: pick(saved.whatsapp_base_url, process.env.WHATSAPP_BASE_URL) || 'https://api.interakt.ai/v1/public/message/',
  };
}
