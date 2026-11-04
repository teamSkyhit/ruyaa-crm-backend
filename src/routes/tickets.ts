import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listTickets, getTicket, updateTicket, replyToTicket, createTicketFromCrm } from '../controllers/ticketController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listTickets);
router.post('/', authMiddleware, staffOrAdmin, createTicketFromCrm);
router.get('/:id', authMiddleware, getTicket);
router.patch('/:id', authMiddleware, staffOrAdmin, updateTicket);
router.post('/:id/replies', authMiddleware, staffOrAdmin, replyToTicket);

export default router;
