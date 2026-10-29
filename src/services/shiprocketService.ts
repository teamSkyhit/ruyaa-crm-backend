import { OrderStatus } from '@prisma/client';
import prisma from '../prismaClient';
import { getShiprocketConfig } from './integrationConfig';
import { notify } from './notificationService';
import { sendOrderDelivered, sendOrderShipped } from './whatsappService';

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

type Serviceability = { deliverable: boolean; estimatedDays: number; courierId: number | null };
const serviceabilityCache = new Map<string, { value: Serviceability; expiresAt: number }>();

export function clearShiprocketAuthCache(): void {
  tokenCache = null;
}

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const config = await getShiprocketConfig();

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: config.email,
      password: config.password,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shiprocket auth failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { token?: string };
  if (!data.token) throw new Error('Shiprocket auth response missing token');

  tokenCache = { token: data.token, expiresAt: Date.now() + 23 * 60 * 60 * 1000 };
  return data.token;
}

async function shiprocketFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
}

export async function isShiprocketConfigured(): Promise<boolean> {
  const config = await getShiprocketConfig();
  return Boolean(config.email && config.password);
}

export async function canCheckShiprocketServiceability(): Promise<boolean> {
  const config = await getShiprocketConfig();
  return Boolean(config.email && config.password && config.pickupPincode);
}

export async function checkServiceability(
  pincode: string,
  weightKg = 0.5
): Promise<Serviceability> {
  const cached = serviceabilityCache.get(pincode);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const pickup = (await getShiprocketConfig()).pickupPincode;
  if (!(await isShiprocketConfigured()) || !pickup) {
    return { deliverable: false, estimatedDays: 0, courierId: null };
  }

  const params = new URLSearchParams({
    pickup_postcode: pickup,
    delivery_postcode: pincode,
    weight: String(weightKg),
    cod: '1',
  });

  const response = await shiprocketFetch(`/courier/serviceability/?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Shiprocket serviceability failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    data?: {
      available_courier_companies?: Array<{
        courier_company_id?: number;
        etd?: string;
        estimated_delivery_days?: string | number;
      }>;
    };
  };

  const couriers = data.data?.available_courier_companies ?? [];
  const first = couriers[0];
  const days = Number(first?.estimated_delivery_days ?? first?.etd ?? 5);
  const value: Serviceability = {
    deliverable: couriers.length > 0,
    estimatedDays: Number.isFinite(days) && days > 0 ? days : 5,
    courierId: first?.courier_company_id ?? null,
  };

  serviceabilityCache.set(pincode, { value, expiresAt: Date.now() + 60 * 60 * 1000 });
  return value;
}

type ShipmentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  shippingCountry: string;
  subtotal: { toString(): string } | number;
  discount: { toString(): string } | number;
  shippingCharge: { toString(): string } | number;
  total: { toString(): string } | number;
  paymentMethod: string;
  createdAt: Date;
  items: Array<{
    productName: string;
    productSku: string;
    quantity: number;
    unitPrice: { toString(): string } | number;
  }>;
};

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] || 'Customer', last: parts.slice(1).join(' ') || '.' };
}

export async function createShipment(
  order: ShipmentOrder
): Promise<{ shiprocketOrderId: string; shipmentId: string; awb: string; courierName: string }> {
  const name = splitName(order.shippingFullName || order.customerName);
  const orderDate = order.createdAt.toISOString().slice(0, 16).replace('T', ' ');

  const config = await getShiprocketConfig();
  const response = await shiprocketFetch('/orders/create/adhoc', {
    method: 'POST',
    body: JSON.stringify({
      order_id: order.orderNumber,
      order_date: orderDate,
      pickup_location: config.pickupLocation,
      channel_id: config.channelId || undefined,
      billing_customer_name: name.first,
      billing_last_name: name.last,
      billing_address: order.shippingAddressLine1,
      billing_address_2: order.shippingAddressLine2 || '',
      billing_city: order.shippingCity,
      billing_pincode: order.shippingPincode,
      billing_state: order.shippingState,
      billing_country: order.shippingCountry || 'India',
      billing_email: order.customerEmail,
      billing_phone: order.shippingPhone || order.customerPhone,
      shipping_is_billing: true,
      order_items: order.items.map((item) => ({
        name: item.productName,
        sku: item.productSku,
        units: item.quantity,
        selling_price: Number(item.unitPrice),
        discount: 0,
        tax: 0,
      })),
      payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
      shipping_charges: Number(order.shippingCharge),
      total_discount: Number(order.discount),
      sub_total: Number(order.subtotal),
      length: 10,
      breadth: 10,
      height: 10,
      weight: 0.5,
    }),
  });

  if (!response.ok) {
    throw new Error(`Shiprocket create order failed: ${response.status} ${await response.text()}`);
  }

  const created = (await response.json()) as {
    order_id?: number | string;
    shipment_id?: number | string;
    awb_code?: string;
    courier_name?: string;
  };

  let awb = created.awb_code || '';
  let courierName = created.courier_name || '';

  if (!awb && created.shipment_id) {
    const assign = await shiprocketFetch('/courier/assign/awb', {
      method: 'POST',
      body: JSON.stringify({ shipment_id: created.shipment_id }),
    });
    if (assign.ok) {
      const assigned = (await assign.json()) as {
        response?: { data?: { awb_code?: string; courier_name?: string } };
      };
      awb = assigned.response?.data?.awb_code || awb;
      courierName = assigned.response?.data?.courier_name || courierName;
    }
  }

  return {
    shiprocketOrderId: String(created.order_id ?? ''),
    shipmentId: created.shipment_id ? String(created.shipment_id) : '',
    awb,
    courierName,
  };
}

export async function getTracking(
  awb: string
): Promise<{ status: string; activities: Array<{ date: string; description: string }> }> {
  const response = await shiprocketFetch(`/courier/track/awb/${encodeURIComponent(awb)}`);
  if (!response.ok) {
    throw new Error(`Shiprocket tracking failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    tracking_data?: {
      track_status?: number | string;
      shipment_track?: Array<{ current_status?: string }>;
      shipment_track_activities?: Array<{ date?: string; activity?: string; location?: string }>;
    };
  };

  const track = data.tracking_data;
  const status = track?.shipment_track?.[0]?.current_status || String(track?.track_status ?? 'unknown');
  const activities = (track?.shipment_track_activities ?? []).map((activity) => ({
    date: activity.date || '',
    description: [activity.activity, activity.location].filter(Boolean).join(' — '),
  }));

  return { status, activities };
}

const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  PENDING_PAYMENT: 1,
  CONFIRMED: 2,
  PROCESSING: 3,
  SHIPPED: 4,
  DELIVERED: 5,
};

function classifyCourierStatus(raw: string): 'delivered' | 'shipped' | 'failed' | 'other' {
  const status = raw.toLowerCase();
  if (status.includes('deliver')) return 'delivered';
  if (/(rto|cancel|undeliver|lost|fail)/.test(status)) return 'failed';
  if (/(transit|ship|pick|out for|manifest|reached)/.test(status)) return 'shipped';
  return 'other';
}

export async function applyCourierUpdate(input: {
  orderNumber?: string;
  awb?: string;
  status: string;
  courierName?: string;
}): Promise<{ applied: boolean }> {
  const order = input.orderNumber
    ? await prisma.order.findUnique({ where: { orderNumber: input.orderNumber } })
    : input.awb
      ? await prisma.order.findFirst({ where: { trackingNumber: input.awb } })
      : null;
  if (!order) return { applied: false };

  const kind = classifyCourierStatus(input.status);
  const nextStatus = kind === 'delivered' ? OrderStatus.DELIVERED : kind === 'shipped' ? OrderStatus.SHIPPED : null;
  const currentRank = STATUS_RANK[order.status] ?? 0;
  const nextRank = nextStatus ? STATUS_RANK[nextStatus] ?? 0 : 0;
  const advance = Boolean(nextStatus && nextRank > currentRank);
  const awb = input.awb || order.trackingNumber;

  await prisma.order.update({
    where: { id: order.id },
    data: {
      courierStatus: input.status.slice(0, 100),
      ...(input.courierName ? { courierName: input.courierName } : {}),
      ...(input.awb ? { trackingNumber: input.awb } : {}),
      ...(awb && !order.trackingUrl ? { trackingUrl: `https://shiprocket.co/tracking/${awb}` } : {}),
      ...(advance && nextStatus === OrderStatus.SHIPPED ? { status: OrderStatus.SHIPPED, shippedAt: order.shippedAt ?? new Date() } : {}),
      ...(advance && nextStatus === OrderStatus.DELIVERED ? { status: OrderStatus.DELIVERED, deliveredAt: order.deliveredAt ?? new Date() } : {}),
    },
  });

  if (advance && nextStatus === OrderStatus.SHIPPED) {
    sendOrderShipped(order.customerPhone, order.orderNumber, awb || '', input.courierName || order.courierName || '');
  }
  if (advance && nextStatus === OrderStatus.DELIVERED) {
    sendOrderDelivered(order.customerPhone, order.orderNumber);
  }
  if (kind === 'failed') {
    await notify({
      type: 'SHIPMENT_FAILED',
      title: `Shipment problem on ${order.orderNumber}`,
      body: input.status,
      link: `/orders/${order.id}`,
    });
  }
  return { applied: true };
}

export async function bookShipment(orderId: string): Promise<{ booked: boolean; reason?: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { booked: false, reason: 'Order not found' };
  if (order.trackingNumber) return { booked: false, reason: 'This order already has a tracking number' };
  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED || order.status === OrderStatus.PENDING_PAYMENT) {
    return { booked: false, reason: 'This order is not ready to ship' };
  }
  if (!(await isShiprocketConfigured())) return { booked: false, reason: 'Shiprocket is not configured' };
  try {
    const result = await createShipment(order);
    if (!result.awb && !result.courierName && !result.shiprocketOrderId) {
      return { booked: false, reason: 'Shiprocket did not return a shipment' };
    }
    await prisma.order.update({
      where: { id: orderId },
      data: {
        ...(result.awb ? { trackingNumber: result.awb, trackingUrl: `https://shiprocket.co/tracking/${result.awb}` } : {}),
        ...(result.courierName ? { courierName: result.courierName } : {}),
        ...(result.shiprocketOrderId ? { shiprocketOrderId: result.shiprocketOrderId } : {}),
        ...(result.shipmentId ? { shipmentId: result.shipmentId } : {}),
        courierStatus: result.awb ? 'AWB assigned' : 'Shipment created',
      },
    });
    return { booked: true };
  } catch (err) {
    console.error('[Shiprocket createShipment]', err);
    await notify({
      type: 'SHIPMENT_FAILED',
      title: `Shipment failed for ${order.orderNumber}`,
      body: 'Shiprocket did not accept the shipment. Check the Shiprocket settings and try again from the order.',
      link: `/orders/${order.id}`,
    });
    return { booked: false, reason: 'Shiprocket did not accept the shipment' };
  }
}

export function scheduleShipment(orderId: string): void {
  void bookShipment(orderId);
}
