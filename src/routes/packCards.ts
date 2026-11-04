import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listPackCards, createPackCard, updatePackCard, deletePackCard } from '../controllers/packCardController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listPackCards);
router.post('/', authMiddleware, staffOrAdmin, createPackCard);
router.put('/:id', authMiddleware, staffOrAdmin, updatePackCard);
router.delete('/:id', authMiddleware, staffOrAdmin, deletePackCard);

export default router;
