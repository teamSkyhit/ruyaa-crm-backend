import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getActivityLogs } from '../controllers/activityController';

const router = Router();

router.get('/', authMiddleware, getActivityLogs);

export default router;
