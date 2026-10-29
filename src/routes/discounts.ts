import { Router } from 'express';
import { listDiscounts, createDiscount, updateDiscount, deleteDiscount } from '../controllers/discountController';
import { authMiddleware as authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, listDiscounts);
router.post('/', authenticate, adminOnly, createDiscount);
router.put('/:id', authenticate, adminOnly, updateDiscount);
router.delete('/:id', authenticate, adminOnly, deleteDiscount);

export default router;
