import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { sendNewsletterWelcome } from '../services/resendService';
import * as razorpayService from '../services/razorpayService';
import * as resendService from '../services/resendService';
import { generateOrderNumber } from '../services/orderNumberService';
import { DiscountType, NotificationType, OrderStatus, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { optionalCustomer } from '../middleware/customerAuth';
import { canCheckShiprocketServiceability, checkServiceability, scheduleShipment } from '../services/shiprocketService';
import { notify, notifyLowStockForOrder } from '../services/notificationService';
import * as whatsappService from '../services/whatsappService';

// ─── SITE SETTINGS ───────────────────────────────────────────────────────────

export async function getSiteSettings(_req: Request, res: Response): Promise<void> {
  try {
    let settings = await prisma.siteSettings.findUnique({
      where: { singleton: 'global' },
    });

    if (!settings) {
      settings = await prisma.siteSettings.create({ data: { singleton: 'global' } });
    }

    // Only return public-safe fields — NEVER expose id, createdAt, updatedAt, singleton, secrets
    res.json({
      success: true,
      data: {
        brandName: settings.brandName,
        tagline: settings.tagline,
        logoUrl: settings.logoUrl,
        faviconUrl: settings.faviconUrl,
        heroTitle: settings.heroTitle,
        heroSubtitle: settings.heroSubtitle,
        shippingCharge: settings.shippingCharge,
        freeShippingThreshold: settings.freeShippingThreshold,
        freeShippingEnabled: settings.freeShippingThreshold !== null,
        contactEmail: settings.contactEmail,
        contactPhone: settings.contactPhone,
        address: settings.address,
        metaTitle: settings.defaultMetaTitle,
        metaDescription: settings.defaultMetaDescription,
        socialFacebook: settings.facebookUrl,
        socialInstagram: settings.instagramUrl,
        socialYoutube: settings.youtubeUrl,
        socialPinterest: settings.pinterestUrl,
        whatsappNumber: settings.whatsappNumber,
        codEnabled: settings.codEnabled,
        announcementBarEnabled: settings.announcementBarEnabled,
        announcementBarText: settings.announcementBarText,
        announcementBarLink: settings.announcementBarLink,
        estimatedDeliveryDays: settings.estimatedDeliveryDays,
        heroCTAText: settings.heroCTAText,
        aboutTitle: settings.aboutTitle,
        aboutText: settings.aboutText,
        aboutImageUrl: settings.aboutImageUrl,
        logoAlt: settings.logoAlt,
        googleAnalyticsId: settings.googleAnalyticsId,
        googleSearchConsoleVerification: settings.googleSearchConsoleVerification,
        returnPolicy: settings.returnPolicy,
        privacyPolicy: settings.privacyPolicy,
        termsOfService: settings.termsOfService,
        shippingPolicy: settings.shippingPolicy,
      },
    });
  } catch (error) {
    console.error('getSiteSettings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch site settings' });
  }
}

// ─── BANNERS ─────────────────────────────────────────────────────────────────

export async function getBanners(_req: Request, res: Response): Promise<void> {
  try {
    const now = new Date();
    const banners = await prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: now } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: banners });
  } catch (error) {
    console.error('getBanners error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch banners' });
  }
}

// ─── PRODUCTS ────────────────────────────────────────────────────────────────

const productPublicSelect = {
  id: true,
  name: true,
  slug: true,
  sku: true,
  sortOrder: true,
  mrp: true,
  salePrice: true,
  weight: true,
  description: true,
  featuredIngredients: true,
  fullIngredients: true,
  shelfLife: true,
  howToUse: true,
  storageInstructions: true,
  manufacturer: true,
  licenceNumber: true,
  image: true,
  images: true,
  quantity: true,
  isActive: true,
  showOnWebsite: true,
  metaTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  imageAlt: true,
  robotsIndex: true,
  robotsFollow: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  subcategory: {
    select: { id: true, name: true, slug: true },
  },
  // Excluded: lowStockThreshold, createdAt, updatedAt, categoryId
};

async function rankedProductIds(options: {
  category?: string;
  subcategory?: string;
  search?: string;
  sortBy: string;
  skip: number;
  limit: number;
}): Promise<string[]> {
  const category = options.category ?? null;
  const subcategory = options.subcategory ?? null;
  const search = options.search ? `%${options.search}%` : null;

  // Price sorts do not need order history. Joining every order line made
  // those listings scan the order tables on every request.
  if (options.sortBy === 'price_asc' || options.sortBy === 'price_desc') {
    const rows = options.sortBy === 'price_asc'
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT p.id
          FROM products p
          LEFT JOIN categories c ON c.id = p."categoryId"
          LEFT JOIN subcategories s ON s.id = p."subcategoryId"
          WHERE p."isActive" = true
            AND (${category}::text IS NULL OR c.slug = ${category})
            AND (${subcategory}::text IS NULL OR s.slug = ${subcategory})
            AND (
              ${search}::text IS NULL
              OR p.name ILIKE ${search}
              OR COALESCE(p.description, '') ILIKE ${search}
            )
          ORDER BY COALESCE(p."salePrice", p.mrp) ASC, p."createdAt" DESC
          LIMIT ${options.limit}
          OFFSET ${options.skip}
        `
      : await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT p.id
          FROM products p
          LEFT JOIN categories c ON c.id = p."categoryId"
          LEFT JOIN subcategories s ON s.id = p."subcategoryId"
          WHERE p."isActive" = true
            AND (${category}::text IS NULL OR c.slug = ${category})
            AND (${subcategory}::text IS NULL OR s.slug = ${subcategory})
            AND (
              ${search}::text IS NULL
              OR p.name ILIKE ${search}
              OR COALESCE(p.description, '') ILIKE ${search}
            )
          ORDER BY COALESCE(p."salePrice", p.mrp) DESC, p."createdAt" DESC
          LIMIT ${options.limit}
          OFFSET ${options.skip}
        `;
    return rows.map((row) => row.id);
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT p.id
    FROM products p
    LEFT JOIN categories c ON c.id = p."categoryId"
    LEFT JOIN subcategories s ON s.id = p."subcategoryId"
    LEFT JOIN order_items oi ON oi."productId" = p.id
    LEFT JOIN orders o ON o.id = oi."orderId"
      AND (${options.sortBy === 'trending'}::boolean = false OR o."createdAt" >= NOW() - INTERVAL '30 days')
    WHERE p."isActive" = true
      AND (${category}::text IS NULL OR c.slug = ${category})
      AND (${subcategory}::text IS NULL OR s.slug = ${subcategory})
      AND (
        ${search}::text IS NULL
        OR p.name ILIKE ${search}
        OR COALESCE(p.description, '') ILIKE ${search}
      )
    GROUP BY p.id, p."createdAt"
    ORDER BY COALESCE(SUM(oi.quantity), 0) DESC, p."createdAt" DESC
    LIMIT ${options.limit}
    OFFSET ${options.skip}
  `;
  return rows.map((row) => row.id);
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  try {
    const { category, subcategory, search, limit: limitStr, page: pageStr, sortBy: sortByRaw } = req.query;

    const limit = Math.min(Number(limitStr) || 20, 100);
    const page = Math.max(Number(pageStr) || 1, 1);
    const skip = (page - 1) * limit;
    const sortBy = typeof sortByRaw === 'string' ? sortByRaw : 'newest';

    const where: Prisma.ProductWhereInput = { isActive: true };

    if (category && typeof category === 'string') {
      where.category = { slug: category };
    }

    if (subcategory && typeof subcategory === 'string') {
      where.subcategory = { slug: subcategory, isActive: true };
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const total = await prisma.product.count({ where });
    const ranked = ['price_asc', 'price_desc', 'popularity', 'trending'].includes(sortBy);

    let products;
    if (ranked) {
      const ids = await rankedProductIds({
        category: typeof category === 'string' ? category : undefined,
        subcategory: typeof subcategory === 'string' ? subcategory : undefined,
        search: typeof search === 'string' ? search : undefined,
        sortBy,
        skip,
        limit,
      });
      const rows = ids.length
        ? await prisma.product.findMany({
            where: { id: { in: ids } },
            select: productPublicSelect,
          })
        : [];
      const order = new Map(ids.map((id, index) => [id, index]));
      products = rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    } else {
      products = await prisma.product.findMany({
        where,
        select: productPublicSelect,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      });
    }

    res.json({
      success: true,
      data: products,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('getProducts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
}

export async function getProductBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findFirst({
      where: { slug, isActive: true },
      select: {
        ...productPublicSelect,
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            name: true,
            sku: true,
            price: true,
            compareAtPrice: true,
            quantity: true,
            isActive: true,
            sortOrder: true,
          },
        },
        benefits: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, title: true, description: true, image: true, imageAlt: true, sortOrder: true },
        },
      },
    });

    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const [packs, faqs, media, highlights, relatedRows] = await Promise.all([
      prisma.packCard.findMany({
        where: { isActive: true, OR: [{ productId: null }, { productId: product.id }] },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          title: true,
          subtitle: true,
          badge: true,
          image: true,
          price: true,
          compareAtPrice: true,
          sortOrder: true,
        },
      }),
      prisma.faq.findMany({
        where: { isActive: true, OR: [{ productId: null }, { productId: product.id }] },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, question: true, answer: true, sortOrder: true },
      }),
      prisma.productMedia.findMany({
        where: { productId: product.id, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, variantId: true, kind: true, url: true, thumbnailUrl: true, altText: true, sortOrder: true },
      }),
      prisma.productHighlight.findMany({
        where: { productId: product.id, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, title: true, description: true, image: true, imageAlt: true, sortOrder: true },
      }),
      prisma.relatedProduct.findMany({
        where: { productId: product.id, related: { isActive: true, showOnWebsite: true } },
        orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
        select: {
          sortOrder: true,
          related: {
            select: {
              id: true,
              name: true,
              slug: true,
              image: true,
              salePrice: true,
              mrp: true,
              quantity: true,
              variants: { where: { isActive: true }, select: { quantity: true } },
            },
          },
        },
      }),
    ]);

    const gallery = media.filter((item) => !item.variantId);
    const variants = product.variants.map((variant) => {
      const variantMedia = media.filter((item) => item.variantId === variant.id);
      return { ...variant, media: variantMedia, usesProductGallery: variantMedia.length === 0 };
    });
    const relatedProducts = relatedRows.map((row) => {
      const item = row.related;
      const hasWeights = item.variants.length > 0;
      const available = hasWeights
        ? item.variants.some((variant) => variant.quantity > 0)
        : item.quantity > 0;
      return {
        id: item.id,
        name: item.name,
        slug: item.slug,
        image: item.image,
        price: item.salePrice ?? item.mrp,
        mrp: item.mrp,
        available,
        sortOrder: row.sortOrder,
      };
    });

    res.json({
      success: true,
      data: { ...product, variants, gallery, highlights, relatedProducts, packs, faqs },
    });
  } catch (error) {
    console.error('getProductBySlug error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
}

// ─── CATEGORIES ──────────────────────────────────────────────────────────────

export async function getCategories(_req: Request, res: Response): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        image: true,
        imageAlt: true,
        sortOrder: true,
        metaTitle: true,
        metaDescription: true,
        canonicalUrl: true,
        ogTitle: true,
        ogDescription: true,
        ogImage: true,
        robotsIndex: true,
        robotsFollow: true,
        subcategories: {
          where: { isActive: true },
          select: {
            id: true, name: true, slug: true, description: true, image: true, imageAlt: true, sortOrder: true,
            metaTitle: true, metaDescription: true, canonicalUrl: true, ogTitle: true, ogDescription: true, ogImage: true,
            robotsIndex: true, robotsFollow: true,
          },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('getCategories error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
}

// ─── ORDERS ──────────────────────────────────────────────────────────────────

interface ShippingSnapshot {
  shippingFullName: string;
  shippingPhone: string;
  shippingAddressLine1: string;
  shippingAddressLine2: string | null;
  shippingCity: string;
  shippingState: string;
  shippingPincode: string;
  savedAddressId: string | null;
}

interface PricedLine {
  productId: string;
  variantId: string | null;
  quantity: number;
  unitPrice: number;
  productName: string;
  productSku: string;
  productImage: string | null;
  productSlug: string;
  stockTarget: 'product' | 'variant';
}

interface CreateOrderBody {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  paymentMethod: 'RAZORPAY' | 'COD';
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  addressId?: string;
  shippingAddress?: {
    name?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  shippingFullName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  shippingPhone?: string;
  notes?: string;
  discountCode?: string;
  // Client-generated UUID sent once per checkout attempt. If the same key arrives
  // twice (double-click, network retry), we return the original order instead of
  // creating a duplicate.
  idempotencyKey?: string;
}

export async function createOrder(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as CreateOrderBody;

    // 1. Validate required fields. Shipping can arrive as a saved addressId,
    // a shippingAddress object, or the original flat fields.
    const requiredFields: Array<keyof CreateOrderBody> = [
      'customerName', 'customerEmail', 'customerPhone', 'paymentMethod', 'items',
    ];
    for (const field of requiredFields) {
      if (!body[field]) {
        res.status(400).json({ success: false, error: `Missing required field: ${field}` });
        return;
      }
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ success: false, error: 'Order must have at least one item' });
      return;
    }

    if (!['RAZORPAY', 'COD'].includes(body.paymentMethod)) {
      res.status(400).json({ success: false, error: 'Invalid payment method' });
      return;
    }

    // 1b. Idempotency check — return the existing order if this key was already processed
    if (body.idempotencyKey && typeof body.idempotencyKey === 'string') {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: body.idempotencyKey },
      });
      if (existing) {
        if (body.paymentMethod === 'RAZORPAY') {
          const keyRow = await prisma.systemConfig.findUnique({ where: { key: 'razorpay_key_id' } });
          res.status(200).json({
            success: true,
            data: {
              order: { id: existing.id, orderNumber: existing.orderNumber },
              razorpayOrderId: existing.razorpayOrderId,
              razorpayKeyId: keyRow?.value ?? '',
            },
          });
        } else {
          res.status(200).json({
            success: true,
            data: {
              order: { id: existing.id, orderNumber: existing.orderNumber, total: existing.total, status: existing.status },
            },
          });
        }
        return;
      }
    }

    let loggedInCustomer: { id: string; email: string } | null = null;
    try {
      loggedInCustomer = await optionalCustomer(req);
    } catch {
      res.status(401).json({ success: false, error: 'Invalid customer token' });
      return;
    }

    let shipping: ShippingSnapshot;
    if (body.addressId) {
      if (!loggedInCustomer) {
        res.status(401).json({ success: false, error: 'Sign in to use a saved address' });
        return;
      }
      const saved = await prisma.address.findFirst({
        where: { id: body.addressId, customerId: loggedInCustomer.id },
      });
      if (!saved) {
        res.status(400).json({ success: false, error: 'Saved address not found' });
        return;
      }
      shipping = {
        shippingFullName: saved.fullName,
        shippingPhone: saved.phone,
        shippingAddressLine1: saved.addressLine1,
        shippingAddressLine2: saved.addressLine2,
        shippingCity: saved.city,
        shippingState: saved.state,
        shippingPincode: saved.pincode,
        savedAddressId: saved.id,
      };
    } else {
      const block = body.shippingAddress;
      const line1 = block?.line1 || body.shippingAddressLine1;
      const city = block?.city || body.shippingCity;
      const state = block?.state || body.shippingState;
      const pincode = block?.pincode || body.shippingPincode;
      const fullName = block?.name || body.shippingFullName || body.customerName;
      const phone = block?.phone || body.shippingPhone || body.customerPhone;
      if (!line1 || !city || !state || !pincode || !fullName || !phone) {
        res.status(400).json({ success: false, error: 'Shipping address is required' });
        return;
      }
      shipping = {
        shippingFullName: fullName,
        shippingPhone: phone,
        shippingAddressLine1: line1,
        shippingAddressLine2: block?.line2 ?? body.shippingAddressLine2 ?? null,
        shippingCity: city,
        shippingState: state,
        shippingPincode: pincode,
        savedAddressId: null,
      };
    }

    // 2. Fetch and validate products — variant price and stock win when variantId is set
    const productIds = [...new Set(body.items.map((i) => i.productId))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { variants: { where: { isActive: true }, select: { id: true } } },
    });

    if (products.length !== productIds.length) {
      res.status(400).json({ success: false, error: 'One or more products not found or inactive' });
      return;
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantIds = body.items.map((item) => item.variantId).filter((id): id is string => Boolean(id));
    const variants = variantIds.length
      ? await prisma.productVariant.findMany({ where: { id: { in: variantIds }, isActive: true } })
      : [];
    const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

    const priced: PricedLine[] = [];
    for (const item of body.items) {
      const product = productMap.get(item.productId);
      const quantity = Number(item.quantity);
      if (!product || !Number.isInteger(quantity) || quantity < 1) {
        res.status(400).json({ success: false, error: 'Each item needs a valid product and quantity' });
        return;
      }
      if (product.variants.length > 0 && !item.variantId) {
        res.status(400).json({ success: false, error: `Choose a variant for ${product.name}` });
        return;
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== product.id) {
          res.status(400).json({ success: false, error: `Invalid variant for ${product.name}` });
          return;
        }
        if (variant.quantity < quantity) {
          res.status(400).json({ success: false, error: `Insufficient stock for: ${product.name} — ${variant.name}` });
          return;
        }
        priced.push({
          productId: product.id,
          variantId: variant.id,
          quantity,
          unitPrice: Number(variant.price),
          productName: `${product.name} — ${variant.name}`,
          productSku: (variant.sku || product.sku).slice(0, 20),
          productImage: product.image,
          productSlug: product.slug,
          stockTarget: 'variant',
        });
      } else {
        if (product.quantity < quantity) {
          res.status(400).json({ success: false, error: `Insufficient stock for: ${product.name}` });
          return;
        }
        priced.push({
          productId: product.id,
          variantId: null,
          quantity,
          unitPrice: Number(product.salePrice ?? product.mrp),
          productName: product.name,
          productSku: product.sku,
          productImage: product.image,
          productSlug: product.slug,
          stockTarget: 'product',
        });
      }
    }

    // 3. Calculate subtotal from resolved line prices
    let subtotal = priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

    // 4. Discount code validation
    let discountAmount = 0;
    let appliedDiscountCode: string | null = null;
    let discountCodeId: string | null = null;
    let discountMaxUses: number | null = null;
    let freeLine: PricedLine | null = null;

    if (body.discountCode) {
      const dc = await prisma.discountCode.findUnique({
        where: { code: body.discountCode.toUpperCase().trim() },
      });

      if (!dc || !dc.isActive) {
        res.status(400).json({ success: false, error: 'Invalid or expired discount code' });
        return;
      }

      const now = new Date();
      if ((dc.validFrom && dc.validFrom > now) || (dc.validUntil && dc.validUntil < now)) {
        res.status(400).json({ success: false, error: 'Discount code is not currently active' });
        return;
      }
      if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) {
        res.status(400).json({ success: false, error: 'Discount code usage limit reached' });
        return;
      }
      if (dc.minOrderAmount !== null && subtotal < Number(dc.minOrderAmount)) {
        res.status(400).json({
          success: false,
          error: `Minimum order amount of ₹${dc.minOrderAmount} required for this code`,
        });
        return;
      }

      if (dc.type === DiscountType.PERCENTAGE) {
        discountAmount = Math.round((subtotal * Number(dc.value)) / 100);
      } else if (dc.type === DiscountType.BOGO) {
        if (!dc.bogoProductId || !priced.some((line) => line.productId === dc.bogoProductId)) {
          res.status(400).json({ success: false, error: 'This offer needs the free product in your cart' });
          return;
        }
        const freeProduct = productMap.get(dc.bogoProductId);
        if (!freeProduct) {
          res.status(400).json({ success: false, error: 'Free product is not available' });
          return;
        }
        const held = priced
          .filter((line) => line.productId === freeProduct.id && line.stockTarget === 'product')
          .reduce((sum, line) => sum + line.quantity, 0);
        if (freeProduct.quantity < held + 1) {
          res.status(400).json({ success: false, error: `Insufficient stock for: ${freeProduct.name}` });
          return;
        }
        freeLine = {
          productId: freeProduct.id,
          variantId: null,
          quantity: 1,
          unitPrice: 0,
          productName: `${freeProduct.name} (Free)`,
          productSku: freeProduct.sku,
          productImage: freeProduct.image,
          productSlug: freeProduct.slug,
          stockTarget: 'product',
        };
      } else if (dc.type === DiscountType.COMBO) {
        const inCart = new Set(priced.map((line) => line.productId));
        if (dc.comboProductIds.some((id) => !inCart.has(id))) {
          res.status(400).json({ success: false, error: 'Add every product in this combo to use the code' });
          return;
        }
        discountAmount = Math.min(Number(dc.comboDiscount ?? 0), subtotal);
      } else {
        discountAmount = Math.min(Number(dc.value), subtotal);
      }

      appliedDiscountCode = dc.code;
      discountCodeId = dc.id;
      discountMaxUses = dc.maxUses;
    }

    const discountedSubtotal = subtotal - discountAmount;

    // 5. Shipping calculation from SiteSettings
    const siteSettings = await prisma.siteSettings.findUnique({
      where: { singleton: 'global' },
    });

    let shippingCharge = siteSettings ? Number(siteSettings.shippingCharge) : 0;
    let freeShippingApplied = false;

    if (
      siteSettings?.freeShippingThreshold !== null &&
      siteSettings?.freeShippingThreshold !== undefined &&
      discountedSubtotal >= Number(siteSettings.freeShippingThreshold)
    ) {
      freeShippingApplied = true;
      shippingCharge = 0;
    }

    const total = discountedSubtotal + shippingCharge;

    // 6. For Razorpay: create Razorpay order before the DB transaction
    let razorpayOrderId: string | undefined;

    if (body.paymentMethod === 'RAZORPAY') {
      const tempReceipt = `temp_${Date.now()}`;
      const rzpOrder = await razorpayService.createRazorpayOrder(total, tempReceipt);
      razorpayOrderId = rzpOrder.id;
    }

    // 7. DB transaction: generate order number, atomic stock decrement, create order, increment discount usage
    const order = await prisma.$transaction(async (tx) => {
      // a. Generate order number atomically
      const orderNumber = await generateOrderNumber(tx);

      const lines = freeLine ? [...priced, freeLine] : priced;

      // b. Atomic stock decrement — throws if any item goes out of stock
      for (const item of lines) {
        const affected = item.stockTarget === 'variant' && item.variantId
          ? await tx.$executeRaw`
              UPDATE product_variants
              SET quantity = quantity - ${item.quantity}
              WHERE id = ${item.variantId}::uuid
              AND quantity >= ${item.quantity}
            `
          : await tx.$executeRaw`
              UPDATE products
              SET quantity = quantity - ${item.quantity}
              WHERE id = ${item.productId}::uuid
              AND quantity >= ${item.quantity}
            `;
        if (affected === 0) {
          throw new Error(`Out of stock: ${item.productName}`);
        }
      }

      // c. Increment discount usage inside the order transaction so two
      // checkouts cannot both pass a maxUses check.
      if (discountCodeId) {
        const updated = await tx.discountCode.updateMany({
          where: {
            id: discountCodeId,
            ...(discountMaxUses !== null ? { usedCount: { lt: discountMaxUses } } : {}),
          },
          data: { usedCount: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new Error('DISCOUNT_LIMIT');
        }
      }

      // d. Create order with nested items
      return tx.order.create({
        data: {
          orderNumber,
          customerId: loggedInCustomer?.id ?? null,
          savedAddressId: shipping.savedAddressId,
          customerName: body.customerName,
          customerEmail: body.customerEmail,
          customerPhone: body.customerPhone,
          shippingFullName: shipping.shippingFullName,
          shippingAddressLine1: shipping.shippingAddressLine1,
          shippingAddressLine2: shipping.shippingAddressLine2,
          shippingCity: shipping.shippingCity,
          shippingState: shipping.shippingState,
          shippingPincode: shipping.shippingPincode,
          shippingPhone: shipping.shippingPhone,
          customerNotes: body.notes ?? null,
          subtotal,
          discount: discountAmount,
          discountCode: appliedDiscountCode ?? null,
          discountCodeId: discountCodeId ?? null,
          shippingCharge,
          freeShippingApplied,
          total,
          paymentMethod: body.paymentMethod as PaymentMethod,
          paymentStatus: PaymentStatus.PENDING,
          // COD: CONFIRMED on creation; Razorpay: PENDING_PAYMENT until signature verified
          status: body.paymentMethod === 'RAZORPAY' ? OrderStatus.PENDING_PAYMENT : OrderStatus.CONFIRMED,
          razorpayOrderId: razorpayOrderId ?? null,
          idempotencyKey: body.idempotencyKey ?? null,
          items: {
            create: (freeLine ? [...priced, freeLine] : priced).map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              productName: item.productName,
              productSku: item.productSku,
              productImage: item.productImage,
              productSlug: item.productSlug,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              subtotal: item.unitPrice * item.quantity,
            })),
          },
        },
        include: { items: { include: { product: true } } },
      });
    });

    // 8. Razorpay: return razorpayOrderId + key for frontend checkout
    if (body.paymentMethod === 'RAZORPAY') {
      const keyRow = await prisma.systemConfig.findUnique({
        where: { key: 'razorpay_key_id' },
      });
      res.status(201).json({
        success: true,
        data: {
          order: { id: order.id, orderNumber: order.orderNumber },
          razorpayOrderId: order.razorpayOrderId,
          razorpayKeyId: keyRow?.value ?? '',
        },
      });
      return;
    }

    // 9. COD: fire-and-forget confirmation email and WhatsApp
    resendService.sendOrderConfirmation(order).catch((err: unknown) => {
      console.error('COD order confirmation email failed:', err);
    });
    whatsappService.sendOrderConfirmed(order.customerPhone, order.orderNumber, Number(order.total).toFixed(2));
    scheduleShipment(order.id);
    void notify({
      type: NotificationType.NEW_ORDER,
      title: `New order ${order.orderNumber}`,
      body: `${order.customerName} placed a cash on delivery order.`,
      link: `/orders/${order.id}`,
    });
    void notifyLowStockForOrder(order.id);

    res.status(201).json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          status: order.status,
        },
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'DISCOUNT_LIMIT') {
      res.status(400).json({ success: false, error: 'Discount code usage limit reached' });
      return;
    }
    console.error('createOrder error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create order';
    res.status(500).json({ success: false, error: message });
  }
}

export async function verifyPayment(req: Request, res: Response): Promise<void> {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      razorpaySignature?: string;
    };

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ success: false, error: 'razorpayOrderId, razorpayPaymentId, and razorpaySignature are required' });
      return;
    }

    // 1. Find order by Razorpay order ID
    const order = await prisma.order.findUnique({
      where: { razorpayOrderId },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Idempotency: if payment was already verified, return success without re-processing
    if (order.paymentStatus === PaymentStatus.PAID) {
      res.json({
        success: true,
        data: { order: { id: order.id, orderNumber: order.orderNumber, status: order.status } },
      });
      return;
    }

    // 2. Verify Razorpay signature
    const isValid = await razorpayService.verifyPaymentSignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid payment signature' });
      return;
    }

    // 3. Update order status
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: PaymentStatus.PAID,
        status: OrderStatus.PROCESSING,
        razorpayPaymentId,
        razorpaySignature,
        confirmedAt: new Date(),
      },
    });

    // 4. Fire-and-forget confirmation email — fetch full order for email template
    const orderWithItems = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: { include: { product: true } } },
    });

    if (orderWithItems) {
      resendService.sendOrderConfirmation(orderWithItems).catch((err: unknown) => {
        console.error('Payment confirmation email failed:', err);
      });
      whatsappService.sendOrderConfirmed(
        orderWithItems.customerPhone,
        orderWithItems.orderNumber,
        Number(orderWithItems.total).toFixed(2)
      );
      scheduleShipment(orderWithItems.id);
      void notify({
        type: NotificationType.NEW_ORDER,
        title: `New order ${orderWithItems.orderNumber}`,
        body: `${orderWithItems.customerName} paid for this order.`,
        link: `/orders/${orderWithItems.id}`,
      });
      void notifyLowStockForOrder(orderWithItems.id);
    }

    // 5. Return
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: OrderStatus.PROCESSING,
        },
      },
    });
  } catch (error) {
    console.error('verifyPayment error:', error);
    res.status(500).json({ success: false, error: 'Failed to verify payment' });
  }
}

export async function trackOrder(req: Request, res: Response): Promise<void> {
  try {
    const { orderNumber } = req.params;
    const verifyPhone = typeof req.query.phone === 'string' ? req.query.phone.trim() : null;
    const verifyEmail = typeof req.query.email === 'string' ? req.query.email.trim().toLowerCase() : null;

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        customerName: true,
        customerPhone: true,
        customerEmail: true,
        total: true,
        shippingFullName: true,
        shippingCity: true,
        shippingState: true,
        shippingPincode: true,
        trackingNumber: true,
        trackingUrl: true,
        courierName: true,
        courierStatus: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            productName: true,
            quantity: true,
            unitPrice: true,
            subtotal: true,
          },
        },
      },
    });

    if (!order) {
      res.status(404).json({ success: false, error: 'Order not found' });
      return;
    }

    // Without phone or email verification, return only order number and status
    if (!verifyPhone && !verifyEmail) {
      res.json({
        success: true,
        data: {
          orderNumber: order.orderNumber,
          status: order.status,
        },
      });
      return;
    }

    // Verify provided email or phone matches the order
    if (verifyPhone && order.customerPhone !== verifyPhone) {
      res.status(403).json({ success: false, error: 'Phone number does not match this order' });
      return;
    }
    if (verifyEmail && order.customerEmail.toLowerCase() !== verifyEmail) {
      res.status(403).json({ success: false, error: 'Email address does not match this order' });
      return;
    }

    // Return full shipping details (strip raw phone and email from response)
    const { customerPhone: _phone, customerEmail: _email, ...publicOrder } = order;
    res.json({ success: true, data: publicOrder });
  } catch (error) {
    console.error('trackOrder error:', error);
    res.status(500).json({ success: false, error: 'Failed to track order' });
  }
}

// ─── PINCODE ─────────────────────────────────────────────────────────────────

export async function checkPincode(req: Request, res: Response): Promise<void> {
  try {
    const pincode = String(req.params.pincode || '').trim();
    if (!/^\d{6}$/.test(pincode)) {
      res.status(400).json({ success: false, error: 'Enter a 6-digit pincode' });
      return;
    }

    const zone = await prisma.pincodeZone.findUnique({ where: { pincode } });
    if (zone) {
      res.json({
        deliverable: zone.deliverable,
        estimatedDays: zone.estimatedDays,
        city: zone.city,
        state: zone.state,
        source: 'zone',
      });
      return;
    }

    if (await canCheckShiprocketServiceability()) {
      try {
        const result = await checkServiceability(pincode);
        res.json({
          deliverable: result.deliverable,
          estimatedDays: result.estimatedDays || 7,
          city: null,
          state: null,
          source: 'shiprocket',
        });
        return;
      } catch (err) {
        console.error('[checkPincode] Shiprocket failed:', err);
      }
    }

    res.json({
      deliverable: true,
      estimatedDays: 7,
      city: null,
      state: null,
      source: 'default',
    });
  } catch (error) {
    console.error('checkPincode error:', error);
    res.status(500).json({ success: false, error: 'Failed to check pincode' });
  }
}

// ─── FAQS ────────────────────────────────────────────────────────────────────

export async function getFaqs(_req: Request, res: Response): Promise<void> {
  try {
    const faqs = await prisma.faq.findMany({
      where: { isActive: true },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sortOrder: true,
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: faqs });
  } catch (error) {
    console.error('getFaqs error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch FAQs' });
  }
}

// ─── DISCOUNT VALIDATION ─────────────────────────────────────────────────────

export async function validateDiscount(req: Request, res: Response): Promise<void> {
  try {
    const { code, orderAmount } = req.body as { code?: string; orderAmount?: number };

    if (!code) {
      res.status(400).json({ success: false, error: 'code is required' });
      return;
    }

    const discount = await prisma.discountCode.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!discount || !discount.isActive) {
      res.status(404).json({ success: false, error: 'Invalid or expired discount code' });
      return;
    }

    const now = new Date();
    if (discount.validFrom && discount.validFrom > now) {
      res.status(400).json({ success: false, error: 'This code is not yet active' });
      return;
    }
    if (discount.validUntil && discount.validUntil < now) {
      res.status(400).json({ success: false, error: 'This code has expired' });
      return;
    }
    if (discount.maxUses !== null && discount.usedCount >= discount.maxUses) {
      res.status(400).json({ success: false, error: 'This code has reached its usage limit' });
      return;
    }

    const amount = Number(orderAmount) || 0;
    if (discount.minOrderAmount !== null && amount < Number(discount.minOrderAmount)) {
      res.status(400).json({
        success: false,
        error: `Minimum order amount of ₹${discount.minOrderAmount} required`,
      });
      return;
    }

    const cartProductIds = Array.isArray(req.body?.items)
      ? req.body.items.map((item: { productId?: string }) => item.productId).filter(Boolean)
      : [];

    let discountAmount = 0;
    if (discount.type === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((amount * Number(discount.value)) / 100);
    } else if (discount.type === DiscountType.BOGO) {
      const qualifies = Boolean(discount.bogoProductId && cartProductIds.includes(discount.bogoProductId));
      if (cartProductIds.length > 0 && !qualifies) {
        res.status(400).json({ success: false, error: 'This offer needs the free product in your cart' });
        return;
      }
      if (qualifies && discount.bogoProductId) {
        const freeProduct = await prisma.product.findUnique({
          where: { id: discount.bogoProductId },
          select: { salePrice: true, mrp: true },
        });
        discountAmount = freeProduct ? Number(freeProduct.salePrice ?? freeProduct.mrp) : 0;
      }
    } else if (discount.type === DiscountType.COMBO) {
      const qualifies = discount.comboProductIds.every((id) => cartProductIds.includes(id));
      discountAmount = qualifies ? Math.min(Number(discount.comboDiscount ?? 0), amount) : 0;
      if (cartProductIds.length > 0 && !qualifies) {
        res.status(400).json({ success: false, error: 'Add every product in this combo to use the code' });
        return;
      }
    } else {
      discountAmount = Math.min(Number(discount.value), amount);
    }

    res.json({
      success: true,
      data: {
        code: discount.code,
        type: discount.type,
        value: discount.value,
        discountAmount,
        finalAmount: amount - discountAmount,
      },
    });
  } catch (error) {
    console.error('validateDiscount error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate discount code' });
  }
}

// ─── ENQUIRIES ───────────────────────────────────────────────────────────────

export async function createEnquiry(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, phone, message, productId } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      message?: string;
      productId?: string;
    };

    if (!name || !phone || !message) {
      res.status(400).json({ success: false, error: 'name, phone, and message are required' });
      return;
    }

    if (productId) {
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        res.status(400).json({ success: false, error: 'Product not found' });
        return;
      }
    }

    const enquiry = await prisma.enquiry.create({
      data: {
        name,
        email: email ?? null,
        phone,
        message,
        productId: productId ?? null,
        ipAddress: req.ip ?? null,
      },
    });

    void notify({
      type: NotificationType.NEW_ENQUIRY,
      title: `New enquiry from ${enquiry.name}`,
      body: enquiry.message.slice(0, 180),
      link: '/enquiries',
    });

    res.status(201).json({ success: true, data: { id: enquiry.id } });
  } catch (error) {
    console.error('createEnquiry error:', error);
    res.status(500).json({ success: false, error: 'Failed to submit enquiry' });
  }
}

// ─── NEWSLETTER ──────────────────────────────────────────────────────────────

export async function subscribeNewsletter(req: Request, res: Response): Promise<void> {
  try {
    const { email, source } = req.body as { email?: string; source?: string };

    if (!email) {
      res.status(400).json({ success: false, error: 'Email is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, error: 'Invalid email address' });
      return;
    }

    const existing = await prisma.newsletterSubscriber.findUnique({ where: { email } });

    if (existing) {
      if (existing.isActive) {
        res.json({ success: true, message: 'Already subscribed' });
        return;
      }
      await prisma.newsletterSubscriber.update({
        where: { email },
        data: { isActive: true },
      });
    } else {
      await prisma.newsletterSubscriber.create({
        data: { email, source: source ?? 'WEBSITE' },
      });
    }

    // Fire-and-forget welcome email — don't fail the signup if email sending fails
    sendNewsletterWelcome(email).catch(() => {});

    res.json({ success: true, message: 'Subscribed successfully' });
  } catch (error) {
    console.error('subscribeNewsletter error:', error);
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
}

// ─── RAZORPAY WEBHOOK ────────────────────────────────────────────────────────

// Note: This handler expects req.body to be a raw Buffer.
// The route applies express.raw({ type: 'application/json' }) only to this endpoint.

interface RazorpayWebhookEvent {
  id: string;
  event: string;
  payload: {
    payment?: { entity: { id: string; order_id: string } };
    refund?: { entity: { id: string; order_id: string; payment_id: string } };
  };
}

export async function handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
  try {
    const rawBody = req.body as Buffer;
    const signature = req.headers['x-razorpay-signature'] as string | undefined;

    if (!signature) {
      res.status(400).json({ success: false, error: 'Missing x-razorpay-signature header' });
      return;
    }

    // 1. Verify webhook signature
    const isValid = await razorpayService.verifyWebhookSignature(rawBody.toString(), signature);
    if (!isValid) {
      res.status(400).json({ success: false, error: 'Invalid webhook signature' });
      return;
    }

    // 2. Parse event
    const event = JSON.parse(rawBody.toString()) as RazorpayWebhookEvent;

    // 3. Idempotency check — return 200 immediately if already processed
    const existing = await prisma.webhookEvent.findUnique({ where: { eventId: event.id } });
    if (existing) {
      res.status(200).json({ success: true });
      return;
    }

    // 4. Record webhook event before processing (prevents double-processing on crash)
    await prisma.webhookEvent.create({
      data: {
        provider: 'razorpay',
        eventId: event.id,
        payload: event as object,
      },
    });

    // 5. Handle event types
    if (event.event === 'payment.captured') {
      const entity = event.payload.payment?.entity;
      if (entity) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: entity.order_id },
          include: { items: { include: { product: true } } },
        });
        if (order && order.paymentStatus === PaymentStatus.PENDING) {
          const updated = await prisma.order.update({
            where: { id: order.id },
            data: {
              paymentStatus: PaymentStatus.PAID,
              status: OrderStatus.PROCESSING,
              razorpayPaymentId: entity.id,
              confirmedAt: new Date(),
            },
          });
          resendService.sendOrderConfirmation({ ...order, ...updated }).catch((err: unknown) => {
            console.error('Webhook payment.captured: confirmation email failed:', err);
          });
          whatsappService.sendOrderConfirmed(
            order.customerPhone,
            order.orderNumber,
            Number(updated.total).toFixed(2)
          );
          scheduleShipment(order.id);
          void notify({
            type: NotificationType.NEW_ORDER,
            title: `New order ${order.orderNumber}`,
            body: `${order.customerName} paid for this order.`,
            link: `/orders/${order.id}`,
          });
          void notifyLowStockForOrder(order.id);
        }
      }
    } else if (event.event === 'payment.failed') {
      const entity = event.payload.payment?.entity;
      if (entity) {
        const order = await prisma.order.findUnique({
          where: { razorpayOrderId: entity.order_id },
          include: { items: true },
        });
        if (order && order.paymentStatus === PaymentStatus.PENDING) {
          await prisma.$transaction(async (tx) => {
            const changed = await tx.order.updateMany({
              where: { id: order.id, paymentStatus: PaymentStatus.PENDING },
              data: { paymentStatus: PaymentStatus.FAILED },
            });
            if (changed.count !== 1) return;
            for (const item of order.items) {
              if (item.variantId) {
                await tx.$executeRaw`
                  UPDATE product_variants
                  SET quantity = quantity + ${item.quantity}
                  WHERE id = ${item.variantId}::uuid
                `;
              } else if (item.productId) {
                await tx.$executeRaw`
                  UPDATE products
                  SET quantity = quantity + ${item.quantity}
                  WHERE id = ${item.productId}::uuid
                `;
              }
            }
          });
          void notify({
            type: NotificationType.PAYMENT_FAILED,
            title: `Payment failed for ${order.orderNumber}`,
            body: `${order.customerName}'s payment did not complete.`,
            link: `/orders/${order.id}`,
          });
        }
      }
    } else if (event.event === 'refund.processed') {
      const entity = event.payload.refund?.entity;
      if (entity) {
        await prisma.refund.updateMany({
          where: { razorpayRefundId: entity.id },
          data: { status: 'PROCESSED' },
        });
      }
    } else {
      console.log(`Razorpay webhook: unhandled event type "${event.event}"`);
    }

    // 6. Always return 200 — Razorpay retries on any non-2xx
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('handleRazorpayWebhook error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Webhook processing failed' });
    }
  }
}
