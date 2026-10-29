import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listPackCards, createPackCard, updatePackCard, deletePackCard } from '../controllers/packCardController';

const router = Router();

router.get('/', authMiddleware, listPackCards);
router.post('/', authMiddleware, adminOnly, createPackCard);
router.put('/:id', authMiddleware, adminOnly, updatePackCard);
router.delete('/:id', authMiddleware, adminOnly, deletePackCard);

export default router;
