import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { listSubscribers, toggleSubscriber, exportCSV, broadcastNewsletter } from '../controllers/newsletterController';

const router = Router();

// /export must come before /:id/toggle
router.get('/export', authMiddleware, exportCSV);

router.get('/', authMiddleware, listSubscribers);
router.post('/broadcast', authMiddleware, broadcastNewsletter);
router.patch('/:id/toggle', authMiddleware, toggleSubscriber);

export default router;
