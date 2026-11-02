import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { getStats } from '../controllers/dashboardController';

const router = Router();

router.get('/', authMiddleware, adminOnly, getStats);

export default router;
