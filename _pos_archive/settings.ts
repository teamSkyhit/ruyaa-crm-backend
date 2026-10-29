// src/routes/settings.ts
import express from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getStoreSettings,
  updateStoreSettings,
  getCounterSettings,
  updateCounterSettings,
  getDeviceSettings,
  updateDeviceSettings,
  getAllDevices,
  getPublicApiKey,
  generatePublicApiKey,
} from '../controllers/settingsController';

const router = express.Router();

// Store settings
router.get('/store/:storeId', authMiddleware, getStoreSettings);
router.put('/store/:storeId', authMiddleware, updateStoreSettings);

// Counter settings
router.get('/counter/:counterId', authMiddleware, getCounterSettings);
router.put('/counter/:counterId', authMiddleware, updateCounterSettings);

// Device settings
router.get('/devices', authMiddleware, getAllDevices);
router.get('/device/:deviceId', authMiddleware, getDeviceSettings);
router.put('/device/:deviceId', authMiddleware, updateDeviceSettings);

// Public API key management (admin only)
router.get('/api-key', authMiddleware, getPublicApiKey);
router.post('/api-key/generate', authMiddleware, generatePublicApiKey);

export default router;
