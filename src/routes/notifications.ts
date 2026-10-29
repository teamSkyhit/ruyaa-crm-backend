import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { listNotifications, markNotificationRead, markAllNotificationsRead } from '../controllers/notificationController';

const router = Router();

router.get('/', authMiddleware, listNotifications);
router.post('/read-all', authMiddleware, markAllNotificationsRead);
router.patch('/:id/read', authMiddleware, markNotificationRead);

export default router;
