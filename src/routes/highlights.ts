import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listHighlights, createHighlight, updateHighlight, deleteHighlight } from '../controllers/highlightController';

const router = Router({ mergeParams: true });
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listHighlights);
router.post('/', authMiddleware, staffOrAdmin, createHighlight);
router.put('/:highlightId', authMiddleware, staffOrAdmin, updateHighlight);
router.delete('/:highlightId', authMiddleware, staffOrAdmin, deleteHighlight);

export default router;
