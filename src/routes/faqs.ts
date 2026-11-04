import { Router } from 'express';
import { listFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs } from '../controllers/faqController';
import { authMiddleware as authenticate, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authenticate, listFaqs);
router.post('/', authenticate, staffOrAdmin, createFaq);
router.put('/reorder', authenticate, staffOrAdmin, reorderFaqs);
router.put('/:id', authenticate, staffOrAdmin, updateFaq);
router.delete('/:id', authenticate, staffOrAdmin, deleteFaq);

export default router;
