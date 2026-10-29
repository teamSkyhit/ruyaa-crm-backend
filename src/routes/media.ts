import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listMedia, createMedia, updateMedia, deleteMedia } from '../controllers/mediaController';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, listMedia);
router.post('/', authMiddleware, adminOnly, createMedia);
router.put('/:mediaId', authMiddleware, adminOnly, updateMedia);
router.delete('/:mediaId', authMiddleware, adminOnly, deleteMedia);

export default router;
