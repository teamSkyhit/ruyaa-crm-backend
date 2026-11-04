import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listVariants, createVariant, updateVariant, deleteVariant } from '../controllers/variantController';

const router = Router({ mergeParams: true });
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listVariants);
router.post('/', authMiddleware, staffOrAdmin, createVariant);
router.put('/:variantId', authMiddleware, staffOrAdmin, updateVariant);
router.delete('/:variantId', authMiddleware, staffOrAdmin, deleteVariant);

export default router;
