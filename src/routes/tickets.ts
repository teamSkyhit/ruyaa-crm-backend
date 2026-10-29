import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listTickets, getTicket, updateTicket, replyToTicket, createTicketFromCrm } from '../controllers/ticketController';

const router = Router();

router.get('/', authMiddleware, listTickets);
router.post('/', authMiddleware, adminOnly, createTicketFromCrm);
router.get('/:id', authMiddleware, getTicket);
router.patch('/:id', authMiddleware, adminOnly, updateTicket);
router.post('/:id/replies', authMiddleware, adminOnly, replyToTicket);

export default router;
