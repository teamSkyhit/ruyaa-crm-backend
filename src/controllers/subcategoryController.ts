import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { createActivityLog } from './activityController';
import { clearPublicReadCache } from '../middleware/publicReadCache';
import { seoData } from '../utils/seoFields';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name) || 'subcategory';
  let slug = base;
  let i = 1;
  while (true) {
    const existing = await prisma.subcategory.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${i++}`;
  }
}

const subcategoryInclude = {
  _count: { select: { products: true } },
} as const;

export async function listSubcategories(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    const subcategories = await prisma.subcategory.findMany({
      where: { categoryId },
      include: subcategoryInclude,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: subcategories });
  } catch (error) {
    console.error('Error fetching subcategories:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch subcategories' });
  }
}

export async function createSubcategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId } = req.params;
    const { name, description, image, slug: bodySlug, sortOrder, isActive } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } });
    if (!category) {
      res.status(404).json({ success: false, error: 'Category not found' });
      return;
    }

    const trimmedName = String(name).trim();
    const nameExists = await prisma.subcategory.findUnique({
      where: { categoryId_name: { categoryId, name: trimmedName } },
      select: { id: true },
    });
    if (nameExists) {
      res.status(400).json({ success: false, error: 'Subcategory name already exists in this category' });
      return;
    }

    let slug: string;
    if (bodySlug) {
      const slugExists = await prisma.subcategory.findUnique({ where: { slug: bodySlug }, select: { id: true } });
      if (slugExists) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = bodySlug;
    } else {
      slug = await generateUniqueSlug(trimmedName);
    }

    const subcategory = await prisma.subcategory.create({
      data: {
        categoryId,
        name: trimmedName,
        description: description ?? null,
        image: image ?? null,
        slug,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        ...seoData(req.body),
      },
      include: subcategoryInclude,
    });

    await createActivityLog({
      entityType: 'SUBCATEGORY',
      entityId: subcategory.id,
      entityName: subcategory.name,
      action: 'CREATE',
      details: `Subcategory created: ${subcategory.name}`,
      userId: req.user?.userId,
    });
    clearPublicReadCache();

    res.status(201).json({ success: true, data: subcategory, message: 'Subcategory created successfully' });
  } catch (error: any) {
    console.error('Error creating subcategory:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Subcategory name or slug already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create subcategory' });
  }
}

export async function updateSubcategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId, id } = req.params;
    const { name, description, image, slug: bodySlug, sortOrder, isActive } = req.body;

    const current = await prisma.subcategory.findFirst({
      where: { id, categoryId },
    });
    if (!current) {
      res.status(404).json({ success: false, error: 'Subcategory not found' });
      return;
    }

    if (name !== undefined && String(name).trim() !== current.name) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        res.status(400).json({ success: false, error: 'name is required' });
        return;
      }
      const nameExists = await prisma.subcategory.findUnique({
        where: { categoryId_name: { categoryId, name: trimmedName } },
        select: { id: true },
      });
      if (nameExists) {
        res.status(400).json({ success: false, error: 'Subcategory name already exists in this category' });
        return;
      }
    }

    let slug: string | undefined;
    if (bodySlug !== undefined) {
      const existing = await prisma.subcategory.findUnique({ where: { slug: bodySlug }, select: { id: true } });
      if (existing && existing.id !== id) {
        res.status(400).json({ success: false, error: 'Slug already in use' });
        return;
      }
      slug = bodySlug;
    } else if (name !== undefined && String(name).trim() !== current.name) {
      slug = await generateUniqueSlug(String(name).trim(), id);
    }

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (slug !== undefined) updateData.slug = slug;
    if (description !== undefined) updateData.description = description;
    if (image !== undefined) updateData.image = image;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    Object.assign(updateData, seoData(req.body));

    const subcategory = await prisma.subcategory.update({
      where: { id },
      data: updateData,
      include: subcategoryInclude,
    });

    await createActivityLog({
      entityType: 'SUBCATEGORY',
      entityId: subcategory.id,
      entityName: subcategory.name,
      action: 'UPDATE',
      details: `Subcategory updated: ${subcategory.name}`,
      userId: req.user?.userId,
    });
    clearPublicReadCache();

    res.json({ success: true, data: subcategory, message: 'Subcategory updated successfully' });
  } catch (error: any) {
    console.error('Error updating subcategory:', error);
    if (error.code === 'P2002') {
      res.status(400).json({ success: false, error: 'Subcategory name or slug already exists' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update subcategory' });
  }
}

export async function deleteSubcategory(req: Request, res: Response): Promise<void> {
  try {
    const { categoryId, id } = req.params;
    const subcategory = await prisma.subcategory.findFirst({
      where: { id, categoryId },
      include: { _count: { select: { products: true } } },
    });
    if (!subcategory) {
      res.status(404).json({ success: false, error: 'Subcategory not found' });
      return;
    }
    if (subcategory._count.products > 0) {
      res.status(400).json({
        success: false,
        error: `Cannot delete subcategory: it has ${subcategory._count.products} product(s)`,
      });
      return;
    }

    await prisma.subcategory.delete({ where: { id } });

    await createActivityLog({
      entityType: 'SUBCATEGORY',
      entityId: subcategory.id,
      entityName: subcategory.name,
      action: 'DELETE',
      details: `Subcategory deleted: ${subcategory.name}`,
      userId: req.user?.userId,
    });
    clearPublicReadCache();

    res.json({ success: true, message: 'Subcategory deleted successfully' });
  } catch (error) {
    console.error('Error deleting subcategory:', error);
    res.status(500).json({ success: false, error: 'Failed to delete subcategory' });
  }
}
