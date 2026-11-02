import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { getActivityLogs } from '../controllers/activityController';

const router = Router();

router.get('/', authMiddleware, adminOnly, getActivityLogs);

export default router;
