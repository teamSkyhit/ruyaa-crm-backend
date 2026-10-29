interface EnquiryForNotification {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  message: string;
  product?: { name: string; websiteSlug?: string | null } | null;
}

export async function sendEnquiryNotification(enquiry: EnquiryForNotification): Promise<void> {
  const apiUrl = process.env.WATI_API_URL;
  const accessToken = process.env.WATI_ACCESS_TOKEN;
  const templateName = process.env.WATI_ENQUIRY_TEMPLATE ?? 'enquiry_received';
  const notifyPhone = process.env.WATI_NOTIFY_PHONE;

  if (!apiUrl || !accessToken || !notifyPhone) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[WATI] Missing WATI_API_URL, WATI_ACCESS_TOKEN, or WATI_NOTIFY_PHONE — skipping notification');
    }
    return;
  }

  const body = JSON.stringify({
    template_name: templateName,
    broadcast_name: `enquiry_${enquiry.id}`,
    receivers: [
      {
        whatsappNumber: notifyPhone,
        customParams: [
          { name: 'customer_name', value: enquiry.name },
          { name: 'customer_phone', value: enquiry.phone },
          { name: 'product_name', value: enquiry.product?.name ?? 'General enquiry' },
          { name: 'message', value: enquiry.message.slice(0, 200) },
        ],
      },
    ],
  });

  const response = await fetch(`${apiUrl}/api/v1/sendTemplateMessage`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`WATI API error ${response.status}: ${text}`);
  }
}
