import { Router } from 'express';
import { listDiscounts, createDiscount, updateDiscount, deleteDiscount } from '../controllers/discountController';
import { authMiddleware as authenticate, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authenticate, listDiscounts);
router.post('/', authenticate, staffOrAdmin, createDiscount);
router.put('/:id', authenticate, staffOrAdmin, updateDiscount);
router.delete('/:id', authenticate, staffOrAdmin, deleteDiscount);

export default router;
