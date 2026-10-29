import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prismaClient';

function customerId(req: Request): string {
  return req.customer!.id;
}

function toAddress(address: {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
}) {
  return {
    id: address.id,
    label: address.label,
    name: address.fullName,
    phone: address.phone,
    line1: address.addressLine1,
    line2: address.addressLine2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
    isDefault: address.isDefault,
  };
}

function readAddressBody(body: Record<string, unknown>) {
  const name = String(body.name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const line1 = String(body.line1 ?? '').trim();
  const city = String(body.city ?? '').trim();
  const state = String(body.state ?? '').trim();
  const pincode = String(body.pincode ?? '').trim();
  if (!name || !phone || !line1 || !city || !state || !pincode) return null;
  return {
    label: body.label ? String(body.label).trim() : null,
    fullName: name,
    phone,
    addressLine1: line1,
    addressLine2: body.line2 ? String(body.line2).trim() : null,
    city,
    state,
    pincode,
  };
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId(req) },
      select: { id: true, email: true, name: true, phone: true },
    });
    if (!customer) {
      res.status(404).json({ error: 'Customer not found' });
      return;
    }
    res.json(customer);
  } catch (error) {
    console.error('[getProfile]', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const name = req.body?.name !== undefined ? String(req.body.name).trim() : undefined;
    const phone = req.body?.phone !== undefined ? String(req.body.phone).trim() : undefined;
    if (name !== undefined && !name) {
      res.status(400).json({ error: 'name cannot be empty' });
      return;
    }

    const customer = await prisma.customer.update({
      where: { id: customerId(req) },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
      },
      select: { id: true, email: true, name: true, phone: true },
    });
    res.json(customer);
  } catch (error) {
    console.error('[updateProfile]', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
}

export async function getOrders(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10));
    const skip = (page - 1) * limit;
    const email = req.customer!.email;

    const where: Prisma.OrderWhereInput = {
      OR: [
        { customerId: customerId(req) },
        { customerEmail: { equals: email, mode: 'insensitive' } },
      ],
    };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: {
              productName: true,
              productSlug: true,
              productImage: true,
              quantity: true,
              unitPrice: true,
              subtotal: true,
              variantId: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[getOrders]', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

export async function getOrderDetail(req: Request, res: Response): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber },
      include: { items: true },
    });

    if (!order) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const owns =
      order.customerId === customerId(req) ||
      order.customerEmail.toLowerCase() === req.customer!.email.toLowerCase();
    if (!owns) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }

    const { razorpaySignature: _signature, ...safe } = order;
    res.json(safe);
  } catch (error) {
    console.error('[getOrderDetail]', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
}

export async function getAddresses(req: Request, res: Response): Promise<void> {
  try {
    const addresses = await prisma.address.findMany({
      where: { customerId: customerId(req) },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(addresses.map(toAddress));
  } catch (error) {
    console.error('[getAddresses]', error);
    res.status(500).json({ error: 'Failed to fetch addresses' });
  }
}

export async function createAddress(req: Request, res: Response): Promise<void> {
  try {
    const data = readAddressBody(req.body ?? {});
    if (!data) {
      res.status(400).json({ error: 'name, phone, line1, city, state, and pincode are required' });
      return;
    }

    const existing = await prisma.address.count({ where: { customerId: customerId(req) } });
    const address = await prisma.address.create({
      data: { ...data, customerId: customerId(req), isDefault: existing === 0 },
    });
    res.status(201).json(toAddress(address));
  } catch (error) {
    console.error('[createAddress]', error);
    res.status(500).json({ error: 'Failed to create address' });
  }
}

export async function updateAddress(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, customerId: customerId(req) },
    });
    if (!existing) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const data = readAddressBody({ ...existing, name: existing.fullName, line1: existing.addressLine1, line2: existing.addressLine2, ...req.body });
    if (!data) {
      res.status(400).json({ error: 'name, phone, line1, city, state, and pincode are required' });
      return;
    }

    const address = await prisma.address.update({ where: { id: existing.id }, data });
    res.json(toAddress(address));
  } catch (error) {
    console.error('[updateAddress]', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
}

export async function deleteAddress(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, customerId: customerId(req) },
    });
    if (!existing) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id: existing.id } });
      if (existing.isDefault) {
        const next = await tx.address.findFirst({
          where: { customerId: customerId(req) },
          orderBy: { createdAt: 'desc' },
        });
        if (next) {
          await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
        }
      }
    });

    res.status(204).send();
  } catch (error) {
    console.error('[deleteAddress]', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
}

export async function setDefaultAddress(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.address.findFirst({
      where: { id: req.params.id, customerId: customerId(req) },
    });
    if (!existing) {
      res.status(404).json({ error: 'Address not found' });
      return;
    }

    const [, address] = await prisma.$transaction([
      prisma.address.updateMany({
        where: { customerId: customerId(req), isDefault: true },
        data: { isDefault: false },
      }),
      prisma.address.update({
        where: { id: existing.id },
        data: { isDefault: true },
      }),
    ]);

    res.json(toAddress(address));
  } catch (error) {
    console.error('[setDefaultAddress]', error);
    res.status(500).json({ error: 'Failed to set default address' });
  }
}

export async function getWishlist(req: Request, res: Response): Promise<void> {
  try {
    const items = await prisma.wishlistItem.findMany({
      where: { customerId: customerId(req) },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            mrp: true,
            salePrice: true,
            image: true,
            images: true,
            quantity: true,
            isActive: true,
          },
        },
      },
    });

    res.json(
      items.map((item) => ({
        id: item.id,
        product: {
          id: item.product.id,
          name: item.product.name,
          slug: item.product.slug,
          price: item.product.salePrice ?? item.product.mrp,
          images: item.product.images.length ? [item.product.images[0]] : item.product.image ? [item.product.image] : [],
          inStock: item.product.isActive && item.product.quantity > 0,
        },
      }))
    );
  } catch (error) {
    console.error('[getWishlist]', error);
    res.status(500).json({ error: 'Failed to fetch wishlist' });
  }
}

export async function addToWishlist(req: Request, res: Response): Promise<void> {
  try {
    const productId = String(req.body?.productId ?? '');
    if (!productId) {
      res.status(400).json({ error: 'productId is required' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    await prisma.wishlistItem.upsert({
      where: { customerId_productId: { customerId: customerId(req), productId } },
      create: { customerId: customerId(req), productId },
      update: {},
    });
    res.status(201).json({ message: 'Added to wishlist' });
  } catch (error) {
    console.error('[addToWishlist]', error);
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
}

export async function removeFromWishlist(req: Request, res: Response): Promise<void> {
  try {
    await prisma.wishlistItem.deleteMany({
      where: { customerId: customerId(req), productId: req.params.productId },
    });
    res.status(204).send();
  } catch (error) {
    console.error('[removeFromWishlist]', error);
    res.status(500).json({ error: 'Failed to update wishlist' });
  }
}
