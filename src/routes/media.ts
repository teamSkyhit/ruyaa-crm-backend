import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listMedia, createMedia, updateMedia, deleteMedia } from '../controllers/mediaController';

const router = Router({ mergeParams: true });
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listMedia);
router.post('/', authMiddleware, staffOrAdmin, createMedia);
router.put('/:mediaId', authMiddleware, staffOrAdmin, updateMedia);
router.delete('/:mediaId', authMiddleware, staffOrAdmin, deleteMedia);

export default router;
