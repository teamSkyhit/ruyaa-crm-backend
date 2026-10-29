import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listRelated, createRelated, updateRelated, deleteRelated } from '../controllers/relatedProductController';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, listRelated);
router.post('/', authMiddleware, adminOnly, createRelated);
router.put('/:relatedId', authMiddleware, adminOnly, updateRelated);
router.delete('/:relatedId', authMiddleware, adminOnly, deleteRelated);

export default router;
