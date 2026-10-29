import { getWhatsappConfig } from './integrationConfig';

function splitPhone(phone: string): { countryCode: string; phoneNumber: string } | null {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return { countryCode: '+91', phoneNumber: digits };
  if (digits.length === 12 && digits.startsWith('91')) {
    return { countryCode: '+91', phoneNumber: digits.slice(2) };
  }
  if (digits.length > 10) {
    return { countryCode: `+${digits.slice(0, digits.length - 10)}`, phoneNumber: digits.slice(-10) };
  }
  return null;
}

async function sendTemplate(phone: string, templateName: string, bodyValues: string[]): Promise<void> {
  const config = await getWhatsappConfig();
  if (!config) return;

  const parsed = splitPhone(phone);
  if (!parsed) {
    console.warn('[WhatsApp] skipped — unusable phone number');
    return;
  }

  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${config.apiKey}`,
      },
      body: JSON.stringify({
        countryCode: parsed.countryCode,
        phoneNumber: parsed.phoneNumber,
        type: 'Template',
        template: {
          name: templateName,
          languageCode: 'en',
          bodyValues,
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[WhatsApp] send failed:', response.status, text);
    }
  } catch (err) {
    console.error('[WhatsApp] send failed:', err);
  }
}

export function sendOrderConfirmed(phone: string, orderNumber: string, total: string | number): void {
  void sendTemplate(phone, 'ruyaa_order_confirmed', [orderNumber, String(total)]);
}

export function sendOrderShipped(
  phone: string,
  orderNumber: string,
  trackingNumber: string,
  courierName: string
): void {
  void sendTemplate(phone, 'ruyaa_order_shipped', [
    orderNumber,
    trackingNumber || '—',
    courierName || 'courier',
  ]);
}

export function sendOrderDelivered(phone: string, orderNumber: string): void {
  void sendTemplate(phone, 'ruyaa_order_delivered', [orderNumber]);
}
