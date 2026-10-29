import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import {
  listEnquiries,
  getEnquiry,
  updateStatus,
  addNotes,
  updateEnquiry,
} from '../controllers/enquiryController';
import { createTicketFromEnquiry } from '../controllers/ticketController';

const router = Router();

router.get('/', authMiddleware, listEnquiries);
router.get('/:id', authMiddleware, getEnquiry);
router.patch('/:id/status', authMiddleware, adminOnly, updateStatus);
router.patch('/:id/notes', authMiddleware, adminOnly, addNotes);
// Combined update kept for backward compatibility
router.put('/:id', authMiddleware, adminOnly, updateEnquiry);
router.post('/:id/ticket', authMiddleware, adminOnly, createTicketFromEnquiry);

export default router;
