// src/controllers/productController.ts
import { Request, Response } from 'express';
import { MediaKind, Prisma } from '@prisma/client';
import prisma from '../prismaClient';
import { generateNextSKU } from '../services/skuService';
import { createActivityLog } from './activityController';
import { clearPublicReadCache } from '../middleware/publicReadCache';
import { seoData } from '../utils/seoFields';

const productInclude = { category: true, subcategory: true } as const;

async function subcategoryForCategory(
  subcategoryId: unknown,
  categoryId: string
): Promise<{ id: string | null } | { error: string }> {
  if (subcategoryId === null || subcategoryId === '') return { id: null };
  if (typeof subcategoryId !== 'string') return { error: 'Subcategory not found' };
  const sub = await prisma.subcategory.findUnique({
    where: { id: subcategoryId },
    select: { id: true, categoryId: true },
  });
  if (!sub || sub.categoryId !== categoryId) {
    return { error: 'Subcategory does not belong to this category' };
  }
  return { id: sub.id };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueProductSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const skip = (page - 1) * limit;

    const { categoryId, subcategoryId, isActive, showOnWebsite, search, sortBy = 'sortOrder', sortOrder = 'asc' } =
      req.query as Record<string, string>;

    const where: Prisma.ProductWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    if (subcategoryId) where.subcategoryId = subcategoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (showOnWebsite !== undefined) where.showOnWebsite = showOnWebsite === 'true';
    if (search) where.name = { contains: search, mode: 'insensitive' };

    const validSortFields: Record<string, boolean> = {
      sortOrder: true, name: true, createdAt: true, updatedAt: true, mrp: true,
    };
    const orderByField = validSortFields[sortBy] ? sortBy : 'sortOrder';
    const direction: Prisma.SortOrder = sortOrder === 'desc' ? 'desc' : 'asc';

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { [orderByField]: direction },
        skip,
        take: limit,
      }),
    ]);

    res.json({
      success: true,
      data: products,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
}

export async function createProduct(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body;

    if (!body.name || body.mrp == null || !body.categoryId) {
      res.status(400).json({ success: false, error: 'name, mrp, and categoryId are required' });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } });
    if (!category) {
      res.status(400).json({ success: false, error: 'Category not found' });
      return;
    }

    if (body.salePrice != null && Number(body.salePrice) >= Number(body.mrp)) {
      res.status(400).json({ success: false, error: 'salePrice must be less than mrp' });
      return;
    }

    let slug: string;
    if (body.slug) {
      const existing = await prisma.product.findUnique({ where: { slug: body.slug }, select: { id: true } });
      if (existing) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = body.slug;
    } else {
      slug = await generateUniqueProductSlug(body.name);
    }

    const sku = await generateNextSKU();

    let subcategoryId: string | null = null;
    if (body.subcategoryId) {
      const resolved = await subcategoryForCategory(body.subcategoryId, body.categoryId);
      if ('error' in resolved) {
        res.status(400).json({ success: false, error: resolved.error });
        return;
      }
      subcategoryId = resolved.id;
    }

    const product = await prisma.product.create({
      data: {
        name: body.name,
        slug,
        sku,
        categoryId: body.categoryId,
        subcategoryId,
        sortOrder: body.sortOrder ?? 0,
        mrp: body.mrp,
        salePrice: body.salePrice ?? null,
        weight: body.weight ?? '125g',
        description: body.description ?? null,
        featuredIngredients: body.featuredIngredients ?? [],
        fullIngredients: body.fullIngredients ?? null,
        shelfLife: body.shelfLife ?? null,
        howToUse: body.howToUse ?? null,
        storageInstructions: body.storageInstructions ?? null,
        manufacturer: body.manufacturer ?? null,
        licenceNumber: body.licenceNumber ?? null,
        image: body.image ?? null,
        images: body.images ?? [],
        quantity: body.quantity ?? 0,
        lowStockThreshold: body.lowStockThreshold ?? 10,
        isActive: body.isActive ?? true,
        showOnWebsite: body.showOnWebsite ?? false,
        metaTitle: body.metaTitle ?? null,
        metaDescription: body.metaDescription ?? null,
        ...seoData(body),
      },
      include: productInclude,
    });

    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: product.id,
      entityName: product.name,
      action: 'CREATE',
      details: `Product created with SKU: ${product.sku}`,
      userId: req.user?.userId,
    });

    const pictureUrls = (product.images?.length ? product.images : product.image ? [product.image] : []).filter(Boolean);
    if (pictureUrls.length) {
      await prisma.productMedia.createMany({
        data: pictureUrls.map((url, index) => ({
          productId: product.id,
          kind: MediaKind.IMAGE,
          url,
          sortOrder: index,
        })),
      });
    }

    clearPublicReadCache();
    res.status(201).json({ success: true, data: product, message: 'Product created successfully' });
  } catch (error: any) {
    console.error('Error creating product:', error);
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      const field = target?.includes('slug') ? 'slug' : target?.includes('sku') ? 'sku' : 'field';
      res.status(400).json({ success: false, error: `Product with this ${field} already exists` });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create product' });
  }
}

export async function updateProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body;

    const current = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, mrp: true, slug: true, categoryId: true, subcategoryId: true },
    });
    if (!current) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const finalMrp = body.mrp != null ? Number(body.mrp) : Number(current.mrp);
    if (body.salePrice != null && Number(body.salePrice) >= finalMrp) {
      res.status(400).json({ success: false, error: 'salePrice must be less than mrp' });
      return;
    }

    let slug: string | undefined;
    if (body.slug !== undefined) {
      const existing = await prisma.product.findUnique({ where: { slug: body.slug }, select: { id: true } });
      if (existing && existing.id !== id) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = body.slug;
    } else if (body.name !== undefined && body.name !== current.name) {
      slug = await generateUniqueProductSlug(body.name, id);
    }

    if (body.categoryId !== undefined) {
      const cat = await prisma.category.findUnique({ where: { id: body.categoryId }, select: { id: true } });
      if (!cat) {
        res.status(400).json({ success: false, error: 'Category not found' });
        return;
      }
    }

    const updateData: Prisma.ProductUpdateInput = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (slug !== undefined) updateData.slug = slug;
    if (body.categoryId !== undefined) updateData.category = { connect: { id: body.categoryId } };

    const nextCategoryId = body.categoryId ?? current.categoryId;
    if (body.subcategoryId !== undefined) {
      const resolved = await subcategoryForCategory(body.subcategoryId, nextCategoryId);
      if ('error' in resolved) {
        res.status(400).json({ success: false, error: resolved.error });
        return;
      }
      if (resolved.id) updateData.subcategory = { connect: { id: resolved.id } };
      else if (current.subcategoryId) updateData.subcategory = { disconnect: true };
    } else if (body.categoryId && current.subcategoryId) {
      const stillValid = await subcategoryForCategory(current.subcategoryId, body.categoryId);
      if ('error' in stillValid) {
        res.status(400).json({ success: false, error: stillValid.error });
        return;
      }
    }
    if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
    if (body.mrp !== undefined) updateData.mrp = body.mrp;
    if (body.salePrice !== undefined) updateData.salePrice = body.salePrice;
    if (body.weight !== undefined) updateData.weight = body.weight;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.featuredIngredients !== undefined) updateData.featuredIngredients = body.featuredIngredients;
    if (body.fullIngredients !== undefined) updateData.fullIngredients = body.fullIngredients;
    if (body.shelfLife !== undefined) updateData.shelfLife = body.shelfLife;
    if (body.howToUse !== undefined) updateData.howToUse = body.howToUse;
    if (body.storageInstructions !== undefined) updateData.storageInstructions = body.storageInstructions;
    if (body.manufacturer !== undefined) updateData.manufacturer = body.manufacturer;
    if (body.licenceNumber !== undefined) updateData.licenceNumber = body.licenceNumber;
    if (body.image !== undefined) updateData.image = body.image;
    if (body.images !== undefined) updateData.images = body.images;
    if (body.quantity !== undefined) updateData.quantity = body.quantity;
    if (body.lowStockThreshold !== undefined) updateData.lowStockThreshold = body.lowStockThreshold;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.showOnWebsite !== undefined) updateData.showOnWebsite = body.showOnWebsite;
    if (body.metaTitle !== undefined) updateData.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined) updateData.metaDescription = body.metaDescription;
    Object.assign(updateData, seoData(body));

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: productInclude,
    });

    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: product.id,
      entityName: product.name,
      action: 'UPDATE',
      details: 'Product updated',
      userId: req.user?.userId,
    });

    clearPublicReadCache();
    res.json({ success: true, data: product, message: 'Product updated successfully' });
  } catch (error: any) {
    console.error('Error updating product:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Slug already in use' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update product' });
  }
}

export async function deleteProduct(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    if (product._count.orderItems > 0) {
      const updated = await prisma.product.update({
        where: { id },
        data: { isActive: false },
        include: productInclude,
      });
      await createActivityLog({
        entityType: 'PRODUCT',
        entityId: updated.id,
        entityName: updated.name,
        action: 'UPDATE',
        details: `Product deactivated (has ${product._count.orderItems} order references)`,
        userId: req.user?.userId,
      });
      res.json({
        success: true,
        data: updated,
        message: 'Product has order references and was deactivated instead of deleted',
      });
      return;
    }

    await prisma.product.delete({ where: { id } });

    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: product.id,
      entityName: product.name,
      action: 'DELETE',
      details: 'Product deleted',
      userId: req.user?.userId,
    });

    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to delete product' });
  }
}

export async function toggleWebsiteVisibility(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, showOnWebsite: true },
    });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }
    const updated = await prisma.product.update({
      where: { id },
      data: { showOnWebsite: !product.showOnWebsite },
      include: productInclude,
    });
    res.json({
      success: true,
      data: updated,
      message: `Product is now ${updated.showOnWebsite ? 'visible' : 'hidden'} on website`,
    });
  } catch (error) {
    console.error('Error toggling visibility:', error);
    res.status(500).json({ success: false, error: 'Failed to toggle visibility' });
  }
}

export async function updateStock(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { quantity } = req.body;

    if (quantity === undefined || typeof quantity !== 'number') {
      res.status(400).json({ success: false, error: 'quantity (number) is required' });
      return;
    }

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true, name: true } });
    if (!product) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: { quantity },
      include: productInclude,
    });

    await createActivityLog({
      entityType: 'PRODUCT',
      entityId: updated.id,
      entityName: updated.name,
      action: 'UPDATE',
      details: `Stock manually set to ${quantity}`,
      userId: req.user?.userId,
    });

    res.json({ success: true, data: updated, message: 'Stock updated successfully' });
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ success: false, error: 'Failed to update stock' });
  }
}
