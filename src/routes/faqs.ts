import { Router } from 'express';
import { listFaqs, createFaq, updateFaq, deleteFaq, reorderFaqs } from '../controllers/faqController';
import { authMiddleware as authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, listFaqs);
router.post('/', authenticate, adminOnly, createFaq);
router.put('/reorder', authenticate, adminOnly, reorderFaqs);
router.put('/:id', authenticate, adminOnly, updateFaq);
router.delete('/:id', authenticate, adminOnly, deleteFaq);

export default router;
