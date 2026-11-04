import { Router } from 'express';
import { listCustomers, getCustomer, updateCustomerNotes } from '../controllers/customerController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listCustomers);
router.get('/:id', authMiddleware, getCustomer);
router.patch('/:id/notes', authMiddleware, staffOrAdmin, updateCustomerNotes);

export default router;
