// src/controllers/settingsController.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../prismaClient';
import { ApiResponse } from '../types';
import { invalidatePublicApiKeyCache } from '../middleware/publicApiKey';

// Whitelist of allowed fields for each settings model
const STORE_SETTINGS_FIELDS = [
  'receiptHeader', 'receiptFooter', 'receiptShowLogo', 'receiptShowGstin',
  'receiptShowAddress', 'receiptShowPhone', 'defaultPrinterType', 'thermalPaperWidth',
  'printerName', 'printerPort', 'printerConnection', 'autoPrintReceipt', 'printAfterPayment',
  'currencySymbol', 'currencyCode', 'dateFormat', 'timeFormat', 'numberFormat', 'language',
  'orderExpiryHoursDraft', 'orderExpiryHoursHandedOff', 'autoCancelExpiredOrders',
  'defaultGstRate', 'gstInclusive', 'showTaxBreakdown',
  'maxDiscountPercent', 'allowManualDiscount', 'roundOffEnabled', 'roundOffMethod',
  'allowNegativeStock', 'reserveStockOnHandoff',
  'lowStockThreshold', 'enableLowStockAlert', 'enableOrderExpiryAlert',
  'autoSyncInterval', 'enableOfflineMode', 'maxOfflineHours',
  // Social / QR Settings
  'googleReviewUrl', 'instagramUrl',
];

// URL validation helper — accepts empty string (to clear the value) or a valid http/https URL
function isValidUrlOrEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const COUNTER_SETTINGS_FIELDS = [
  'theme', 'fontSize', 'showProductImages', 'itemsPerPage',
  'enableSounds', 'soundOnSale', 'soundOnPayment', 'soundOnError',
  'printerName', 'printerPort', 'autoPrintReceipt',
  'requireShiftOpen', 'autoCloseShift', 'showStockWarning',
];

const DEVICE_SETTINGS_FIELDS = [
  'deviceName', 'deviceType', 'osVersion', 'appVersion',
  'apiBaseUrl', 'connectionType', 'lastSyncAt',
  'cacheProducts', 'cacheExpiryHours', 'lastCacheUpdate',
  'printerConnected', 'printerLastTest', 'printerStatus',
];

// Pick only whitelisted fields from an object
function pickAllowed(data: Record<string, any>, allowedFields: string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of allowedFields) {
    if (key in data) {
      result[key] = data[key];
    }
  }
  return result;
}

// Get store settings
export const getStoreSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let settings = await prisma.storeSettings.findUnique({
      where: { storeId },
    });

    if (!settings) {
      // Create with schema defaults (no need to specify fields that have defaults)
      settings = await prisma.storeSettings.create({
        data: { storeId },
      });
    }

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error fetching store settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch store settings',
    };
    res.status(500).json(response);
  }
};

// Update store settings
export const updateStoreSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const safeData = pickAllowed(req.body, STORE_SETTINGS_FIELDS);

    // Validate URL fields
    if ('googleReviewUrl' in safeData && !isValidUrlOrEmpty(safeData.googleReviewUrl)) {
      res.status(400).json({ success: false, error: 'googleReviewUrl must be a valid http/https URL or empty' });
      return;
    }
    if ('instagramUrl' in safeData && !isValidUrlOrEmpty(safeData.instagramUrl)) {
      res.status(400).json({ success: false, error: 'instagramUrl must be a valid http/https URL or empty' });
      return;
    }

    const settings = await prisma.storeSettings.upsert({
      where: { storeId },
      update: safeData,
      create: {
        storeId,
        ...safeData,
      },
    });

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error updating store settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update store settings',
    };
    res.status(500).json(response);
  }
};

// Get counter settings
export const getCounterSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let settings = await prisma.counterSettings.findUnique({
      where: { counterId },
    });

    if (!settings) {
      // Create with schema defaults
      settings = await prisma.counterSettings.create({
        data: { counterId },
      });
    }

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error fetching counter settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch counter settings',
    };
    res.status(500).json(response);
  }
};

// Update counter settings
export const updateCounterSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { counterId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const safeData = pickAllowed(req.body, COUNTER_SETTINGS_FIELDS);

    const settings = await prisma.counterSettings.upsert({
      where: { counterId },
      update: safeData,
      create: {
        counterId,
        ...safeData,
      },
    });

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error updating counter settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update counter settings',
    };
    res.status(500).json(response);
  }
};

// List all registered devices
export const getAllDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const devices = await prisma.deviceSettings.findMany({
      orderBy: { updatedAt: 'desc' },
    });

    const response: ApiResponse<any> = { success: true, data: devices };
    res.json(response);
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch devices' });
  }
};

// Get device settings
export const getDeviceSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    let settings = await prisma.deviceSettings.findUnique({
      where: { deviceId },
    });

    if (!settings) {
      // Create with schema defaults
      settings = await prisma.deviceSettings.create({
        data: { deviceId },
      });
    }

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error fetching device settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to fetch device settings',
    };
    res.status(500).json(response);
  }
};

// Update device settings
export const updateDeviceSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const safeData = pickAllowed(req.body, DEVICE_SETTINGS_FIELDS);

    const settings = await prisma.deviceSettings.upsert({
      where: { deviceId },
      update: safeData,
      create: {
        deviceId,
        ...safeData,
      },
    });

    const response: ApiResponse<any> = { success: true, data: settings };
    res.json(response);
  } catch (error) {
    console.error('Error updating device settings:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update device settings',
    };
    res.status(500).json(response);
  }
};

// ─── Public API Key Management ───────────────────────────────────────────────

export const getPublicApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await prisma.systemConfig.findUnique({ where: { key: 'public_api_key' } });

    if (!row) {
      const response: ApiResponse<any> = { success: true, data: { configured: false, key: null } };
      res.json(response);
      return;
    }

    // Return masked key: show first 6 and last 4 chars only
    const full = row.value;
    const masked = full.length > 10
      ? `${full.slice(0, 6)}${'•'.repeat(full.length - 10)}${full.slice(-4)}`
      : '•'.repeat(full.length);

    const response: ApiResponse<any> = {
      success: true,
      data: { configured: true, maskedKey: masked, keyLength: full.length, updatedAt: row.updatedAt },
    };
    res.json(response);
  } catch (error) {
    console.error('Error fetching public API key:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch API key' });
  }
};

export const generatePublicApiKey = async (req: Request, res: Response): Promise<void> => {
  try {
    const newKey = crypto.randomBytes(32).toString('hex'); // 64-char hex key

    const row = await prisma.systemConfig.upsert({
      where: { key: 'public_api_key' },
      update: { value: newKey },
      create: { key: 'public_api_key', value: newKey },
    });

    invalidatePublicApiKeyCache();

    const full = row.value;
    const masked = `${full.slice(0, 6)}${'•'.repeat(full.length - 10)}${full.slice(-4)}`;

    const response: ApiResponse<any> = {
      success: true,
      data: { configured: true, maskedKey: masked, fullKey: newKey, keyLength: full.length, updatedAt: row.updatedAt },
    };
    res.json(response);
  } catch (error) {
    console.error('Error generating public API key:', error);
    res.status(500).json({ success: false, error: 'Failed to generate API key' });
  }
};
