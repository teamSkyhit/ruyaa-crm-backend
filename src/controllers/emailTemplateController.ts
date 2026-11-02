import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getAll(req: Request, res: Response): Promise<void> {
  const templates = await prisma.emailTemplate.findMany({ orderBy: { key: 'asc' } });
  res.json({ success: true, data: templates });
}

export async function getOne(req: Request, res: Response): Promise<void> {
  const template = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
  res.json({ success: true, data: template });
}

export async function create(req: Request, res: Response): Promise<void> {
  const { key, name, subject, bodyHtml, variables, isActive } = req.body;
  if (!key || !name || !subject || !bodyHtml) {
    res.status(400).json({ success: false, error: 'key, name, subject, and bodyHtml are required' });
    return;
  }
  const template = await prisma.emailTemplate.create({
    data: { key, name, subject, bodyHtml, variables: variables ?? [], isActive: isActive ?? true },
  });
  res.status(201).json({ success: true, data: template });
}

export async function update(req: Request, res: Response): Promise<void> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
  const { name, subject, bodyHtml, variables, isActive } = req.body;
  const template = await prisma.emailTemplate.update({
    where: { id: req.params.id },
    data: { name, subject, bodyHtml, variables, isActive },
  });
  res.json({ success: true, data: template });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const existing = await prisma.emailTemplate.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
  await prisma.emailTemplate.delete({ where: { id: req.params.id } });
  res.status(204).send();
}
