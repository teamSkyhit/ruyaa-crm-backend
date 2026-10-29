import { Request, Response } from 'express';
import { DiscountType } from '@prisma/client';
import prisma from '../prismaClient';

const TYPES = new Set<string>(Object.values(DiscountType));

function readDiscount(body: Record<string, unknown>, partial: boolean) {
  const type = body.type !== undefined ? String(body.type) : undefined;
  if (type && !TYPES.has(type)) return { error: 'Invalid discount type' };

  const resolvedType = (type || DiscountType.PERCENTAGE) as DiscountType;
  if (!partial && resolvedType === DiscountType.BOGO && !body.bogoProductId) {
    return { error: 'bogoProductId is required for BOGO offers' };
  }
  if (!partial && resolvedType === DiscountType.COMBO) {
    const ids = Array.isArray(body.comboProductIds) ? body.comboProductIds : [];
    if (ids.length < 2 || body.comboDiscount === undefined || body.comboDiscount === '') {
      return { error: 'comboProductIds and comboDiscount are required for COMBO offers' };
    }
  }

  return { type: resolvedType };
}

export async function listDiscounts(_req: Request, res: Response): Promise<void> {
  try {
    const discounts = await prisma.discountCode.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ discounts });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch discount codes' });
  }
}

export async function createDiscount(req: Request, res: Response): Promise<void> {
  try {
    const { code, type, value, minOrderAmount, maxUses, isActive, validFrom, validUntil, bogoProductId, comboProductIds, comboDiscount } = req.body;
    if (!code) {
      res.status(400).json({ error: 'code is required' });
      return;
    }
    const parsed = readDiscount(req.body, false);
    if (parsed.error || !parsed.type) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    if ((parsed.type === DiscountType.PERCENTAGE || parsed.type === DiscountType.FIXED) && (value === undefined || value === '')) {
      res.status(400).json({ error: 'value is required' });
      return;
    }

    const discount = await prisma.discountCode.create({
      data: {
        code: String(code).toUpperCase().trim(),
        type: parsed.type,
        value: value === undefined || value === '' ? 0 : value,
        minOrderAmount: minOrderAmount || null,
        maxUses: maxUses || null,
        isActive: isActive ?? true,
        validFrom: validFrom ? new Date(validFrom) : null,
        validUntil: validUntil ? new Date(validUntil) : null,
        bogoProductId: bogoProductId || null,
        comboProductIds: Array.isArray(comboProductIds) ? comboProductIds.map(String) : [],
        comboDiscount: comboDiscount === undefined || comboDiscount === '' ? null : comboDiscount,
      },
    });
    res.status(201).json({ discount });
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(409).json({ error: 'Code already exists' }); return; }
    console.error('[createDiscount]', error);
    res.status(500).json({ error: 'Failed to create discount code' });
  }
}

export async function updateDiscount(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { code, type, value, minOrderAmount, maxUses, isActive, validFrom, validUntil, bogoProductId, comboProductIds, comboDiscount } = req.body;
    if (type !== undefined) {
      const parsed = readDiscount(req.body, true);
      if (parsed.error) {
        res.status(400).json({ error: parsed.error });
        return;
      }
    }
    const discount = await prisma.discountCode.update({
      where: { id },
      data: {
        ...(code !== undefined && { code: String(code).toUpperCase().trim() }),
        ...(type !== undefined && { type }),
        ...(value !== undefined && { value }),
        ...(minOrderAmount !== undefined && { minOrderAmount }),
        ...(maxUses !== undefined && { maxUses }),
        ...(isActive !== undefined && { isActive }),
        ...(validFrom !== undefined && { validFrom: validFrom ? new Date(validFrom) : null }),
        ...(validUntil !== undefined && { validUntil: validUntil ? new Date(validUntil) : null }),
        ...(bogoProductId !== undefined && { bogoProductId: bogoProductId || null }),
        ...(comboProductIds !== undefined && {
          comboProductIds: Array.isArray(comboProductIds) ? comboProductIds.map(String) : [],
        }),
        ...(comboDiscount !== undefined && { comboDiscount: comboDiscount === '' || comboDiscount === null ? null : comboDiscount }),
      },
    });
    res.json({ discount });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Discount code not found' }); return; }
    if (error.code === 'P2002') { res.status(409).json({ error: 'Code already exists' }); return; }
    console.error('[updateDiscount]', error);
    res.status(500).json({ error: 'Failed to update discount code' });
  }
}

export async function deleteDiscount(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.discountCode.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') { res.status(404).json({ error: 'Discount code not found' }); return; }
    res.status(500).json({ error: 'Failed to delete discount code' });
  }
}
