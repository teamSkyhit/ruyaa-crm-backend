import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listSubscribers, toggleSubscriber, exportCSV, broadcastNewsletter } from '../controllers/newsletterController';

const router = Router();

const staffOrAdmin = requireRole(['admin', 'user']);

// /export must come before /:id/toggle
router.get('/export', authMiddleware, staffOrAdmin, exportCSV);

router.get('/', authMiddleware, staffOrAdmin, listSubscribers);
router.post('/broadcast', authMiddleware, staffOrAdmin, broadcastNewsletter);
router.patch('/:id/toggle', authMiddleware, staffOrAdmin, toggleSubscriber);

export default router;
