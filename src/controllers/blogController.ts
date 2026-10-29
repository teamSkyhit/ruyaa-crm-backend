import { Request, Response } from 'express';
import prisma from '../prismaClient';
import { seoData } from '../utils/seoFields';
import { clearPublicReadCache } from '../middleware/publicReadCache';

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base || 'post';
}

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.blog.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${suffix++}`;
  }
}

function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value.split(',').map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

export async function listBlogs(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blog.count(),
    ]);

    res.json({
      blogs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[listBlogs]', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
}

export async function getBlog(req: Request, res: Response): Promise<void> {
  try {
    const blog = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!blog) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    res.json({ blog });
  } catch (error) {
    console.error('[getBlog]', error);
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
}

export async function createBlog(req: Request, res: Response): Promise<void> {
  try {
    const title = String(req.body?.title ?? '').trim();
    const body = String(req.body?.body ?? '').trim();
    if (!title || !body) {
      res.status(400).json({ error: 'title and body are required' });
      return;
    }

    const slug = await uniqueSlug(title);
    const isPublished = Boolean(req.body?.isPublished);
    const blog = await prisma.blog.create({
      data: {
        title,
        slug,
        body,
        excerpt: req.body?.excerpt ? String(req.body.excerpt) : null,
        coverUrl: req.body?.coverUrl ? String(req.body.coverUrl) : null,
        tags: parseTags(req.body?.tags),
        ...seoData(req.body ?? {}, { coverAlt: true }),
        authorName: req.body?.authorName ? String(req.body.authorName) : 'Ruyaa Team',
        isPublished,
        publishedAt: isPublished ? new Date() : null,
      },
    });
    clearPublicReadCache();
    res.status(201).json({ blog });
  } catch (error) {
    console.error('[createBlog]', error);
    res.status(500).json({ error: 'Failed to create blog' });
  }
}

export async function updateBlog(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }

    const title = req.body?.title !== undefined ? String(req.body.title).trim() : undefined;
    const slug = title && title !== existing.title ? await uniqueSlug(title, existing.id) : undefined;

    const blog = await prisma.blog.update({
      where: { id: existing.id },
      data: {
        ...(title ? { title, slug } : {}),
        ...(req.body?.body !== undefined ? { body: String(req.body.body) } : {}),
        ...(req.body?.excerpt !== undefined ? { excerpt: req.body.excerpt ? String(req.body.excerpt) : null } : {}),
        ...(req.body?.coverUrl !== undefined ? { coverUrl: req.body.coverUrl ? String(req.body.coverUrl) : null } : {}),
        ...(req.body?.tags !== undefined ? { tags: parseTags(req.body.tags) } : {}),
        ...seoData(req.body ?? {}, { coverAlt: true }),
        ...(req.body?.authorName !== undefined ? { authorName: String(req.body.authorName) } : {}),
        ...(req.body?.isPublished !== undefined ? { isPublished: Boolean(req.body.isPublished) } : {}),
      },
    });
    clearPublicReadCache();
    res.json({ blog });
  } catch (error) {
    console.error('[updateBlog]', error);
    res.status(500).json({ error: 'Failed to update blog' });
  }
}

export async function publishBlog(req: Request, res: Response): Promise<void> {
  try {
    const existing = await prisma.blog.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    const blog = await prisma.blog.update({
      where: { id: existing.id },
      data: { isPublished: true, publishedAt: existing.publishedAt ?? new Date() },
    });
    res.json({ blog });
  } catch (error) {
    console.error('[publishBlog]', error);
    res.status(500).json({ error: 'Failed to publish blog' });
  }
}

export async function unpublishBlog(req: Request, res: Response): Promise<void> {
  try {
    const blog = await prisma.blog.update({
      where: { id: req.params.id },
      data: { isPublished: false },
    });
    res.json({ blog });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    console.error('[unpublishBlog]', error);
    res.status(500).json({ error: 'Failed to unpublish blog' });
  }
}

export async function deleteBlog(req: Request, res: Response): Promise<void> {
  try {
    await prisma.blog.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Blog not found' });
      return;
    }
    console.error('[deleteBlog]', error);
    res.status(500).json({ error: 'Failed to delete blog' });
  }
}

const publicBlogSelect = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  coverUrl: true,
  coverAlt: true,
  tags: true,
  authorName: true,
  publishedAt: true,
  metaTitle: true,
  metaDescription: true,
  canonicalUrl: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  robotsIndex: true,
  robotsFollow: true,
} as const;

export async function listPublicBlogs(req: Request, res: Response): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 12));
    const skip = (page - 1) * limit;
    const tag = typeof req.query.tag === 'string' ? req.query.tag.trim() : '';

    const where = {
      isPublished: true,
      ...(tag ? { tags: { has: tag } } : {}),
    };

    const [blogs, total] = await Promise.all([
      prisma.blog.findMany({
        where,
        select: publicBlogSelect,
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.blog.count({ where }),
    ]);

    res.json({
      blogs,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('[listPublicBlogs]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blogs' });
  }
}

export async function getPublicBlog(req: Request, res: Response): Promise<void> {
  try {
    const blog = await prisma.blog.findFirst({
      where: { slug: req.params.slug, isPublished: true },
      select: {
        ...publicBlogSelect,
        body: true,
      },
    });
    if (!blog) {
      res.status(404).json({ success: false, error: 'Blog not found' });
      return;
    }
    res.json(blog);
  } catch (error) {
    console.error('[getPublicBlog]', error);
    res.status(500).json({ success: false, error: 'Failed to fetch blog' });
  }
}
