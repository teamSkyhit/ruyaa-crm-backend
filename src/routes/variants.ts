import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listVariants, createVariant, updateVariant, deleteVariant } from '../controllers/variantController';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, listVariants);
router.post('/', authMiddleware, adminOnly, createVariant);
router.put('/:variantId', authMiddleware, adminOnly, updateVariant);
router.delete('/:variantId', authMiddleware, adminOnly, deleteVariant);

export default router;
