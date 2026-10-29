import { Router } from 'express';
import { listCustomers, getCustomer, updateCustomerNotes } from '../controllers/customerController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, listCustomers);
router.get('/:id', authMiddleware, getCustomer);
router.patch('/:id/notes', authMiddleware, adminOnly, updateCustomerNotes);

export default router;
