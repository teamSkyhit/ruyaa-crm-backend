import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getStats } from '../controllers/dashboardController';

const router = Router();

router.get('/', authMiddleware, getStats);

export default router;
