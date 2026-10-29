import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listHighlights, createHighlight, updateHighlight, deleteHighlight } from '../controllers/highlightController';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, listHighlights);
router.post('/', authMiddleware, adminOnly, createHighlight);
router.put('/:highlightId', authMiddleware, adminOnly, updateHighlight);
router.delete('/:highlightId', authMiddleware, adminOnly, deleteHighlight);

export default router;
