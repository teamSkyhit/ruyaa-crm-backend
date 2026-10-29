import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { getConfig, setConfig } from '../controllers/systemConfigController';

const router = Router();

router.get('/', authMiddleware, adminOnly, getConfig);
router.put('/:key', authMiddleware, adminOnly, setConfig);

export default router;
