import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listRelated, createRelated, updateRelated, deleteRelated } from '../controllers/relatedProductController';

const router = Router({ mergeParams: true });
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listRelated);
router.post('/', authMiddleware, staffOrAdmin, createRelated);
router.put('/:relatedId', authMiddleware, staffOrAdmin, updateRelated);
router.delete('/:relatedId', authMiddleware, staffOrAdmin, deleteRelated);

export default router;
