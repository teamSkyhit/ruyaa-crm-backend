import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listSubscribers, toggleSubscriber, exportCSV, broadcastNewsletter } from '../controllers/newsletterController';

const router = Router();

// /export must come before /:id/toggle
router.get('/export', authMiddleware, adminOnly, exportCSV);

router.get('/', authMiddleware, adminOnly, listSubscribers);
router.post('/broadcast', authMiddleware, adminOnly, broadcastNewsletter);
router.patch('/:id/toggle', authMiddleware, adminOnly, toggleSubscriber);

export default router;
