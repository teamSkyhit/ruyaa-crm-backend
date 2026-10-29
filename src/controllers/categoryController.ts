// src/controllers/categoryController.ts
import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { createActivityLog } from './activityController';
import { clearPublicReadCache } from '../middleware/publicReadCache';
import { seoData } from '../utils/seoFields';

const categoryInclude = {
  _count: { select: { products: true } },
  subcategories: { orderBy: [{ sortOrder: 'asc' as const }, { name: 'asc' as const }] },
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueCategorySlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

export async function listCategories(req: Request, res: Response): Promise<void> {
  try {
    const categories = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch categories' });
  }
}

export async function getCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: { products: true, subcategories: { orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] } },
    });
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.json({ success: true, data: category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch category' });
  }
}

export async function createCategory(req: Request, res: Response): Promise<void> {
  try {
    const { name, description, image, slug: bodySlug, sortOrder, isActive } = req.body;

    if (!name) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const nameExists = await prisma.category.findUnique({ where: { name }, select: { id: true } });
    if (nameExists) {
      res.status(400).json({ success: false, error: 'Category name already exists' });
      return;
    }

    let slug: string;
    if (bodySlug) {
      const slugExists = await prisma.category.findUnique({ where: { slug: bodySlug }, select: { id: true } });
      if (slugExists) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = bodySlug;
    } else {
      slug = await generateUniqueCategorySlug(name);
    }

    const category = await prisma.category.create({
      data: {
        name,
        description: description ?? null,
        image: image ?? null,
        slug,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        ...seoData(req.body),
      },
      include: categoryInclude,
    });

    await createActivityLog({
      entityType: 'CATEGORY',
      entityId: category.id,
      entityName: category.name,
      action: 'CREATE',
      details: `Category created: ${category.name}`,
      userId: req.user?.userId,
    });

    clearPublicReadCache();
    res.status(201).json({ success: true, data: category, message: 'Category created successfully' });
  } catch (error: any) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      const target = error.meta?.target as string[] | undefined;
      const field = target?.includes('slug') ? 'slug' : 'name';
      res.status(400).json({ success: false, error: `Category with this ${field} already exists` });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create category' });
  }
}

export async function updateCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, image, slug: bodySlug, sortOrder, isActive } = req.body;

    const current = await prisma.category.findUnique({
      where: { id },
      select: { id: true, name: true, slug: true },
    });
    if (!current) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    if (name !== undefined && name !== current.name) {
      const nameExists = await prisma.category.findUnique({ where: { name }, select: { id: true } });
      if (nameExists) {
        res.status(400).json({ success: false, error: 'Category name already exists' });
        return;
      }
    }

    let slug: string | undefined;
    if (bodySlug !== undefined) {
      const existing = await prisma.category.findUnique({ where: { slug: bodySlug }, select: { id: true } });
      if (existing && existing.id !== id) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = bodySlug;
    } else if (name !== undefined && name !== current.name) {
      slug = await generateUniqueCategorySlug(name, id);
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    Object.assign(updateData, seoData(req.body));

    const category = await prisma.category.update({
      where: { id },
      data: updateData,
      include: categoryInclude,
    });

    await createActivityLog({
      entityType: 'CATEGORY',
      entityId: category.id,
      entityName: category.name,
      action: 'UPDATE',
      details: `Category updated: ${category.name}`,
      userId: req.user?.userId,
    });

    clearPublicReadCache();
    res.json({ success: true, data: category, message: 'Category updated successfully' });
  } catch (error: any) {
    console.error('Error updating category:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Category name or slug already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update category' });
  }
}

export async function deleteCategory(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: categoryInclude,
    });
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    if (category._count.products > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete category: it has ${category._count.products} product(s)`,
      });
      return;
    }

    await prisma.category.delete({ where: { id } });

    await createActivityLog({
      entityType: 'CATEGORY',
      entityId: category.id,
      entityName: category.name,
      action: 'DELETE',
      details: `Category deleted: ${category.name}`,
      userId: req.user?.userId,
    });

    clearPublicReadCache();
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to delete category' });
  }
}

export async function reorderCategories(req: Request, res: Response): Promise<void> {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'items array with [{id, sortOrder}] is required' });
      return;
    }

    await prisma.$transaction(
      items.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
        prisma.category.update({ where: { id }, data: { sortOrder } })
      )
    );

    const categories = await prisma.category.findMany({
      include: categoryInclude,
      orderBy: { sortOrder: 'asc' },
    });

    clearPublicReadCache();
    res.json({ success: true, data: categories, message: 'Categories reordered successfully' });
  } catch (error: any) {
    console.error('Error reordering categories:', error);
    if (error.code === 'P2025') {
      res.status(400).json({ success: false, error: 'One or more category IDs not found' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to reorder categories' });
  }
}
