import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { getSettings, updateSettings } from '../controllers/siteSettingsController';

const router = Router();

router.get('/', authMiddleware, getSettings);
router.put('/', authMiddleware, adminOnly, updateSettings);

export default router;
