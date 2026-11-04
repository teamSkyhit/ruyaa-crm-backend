import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listEnquiries,
  getEnquiry,
  updateStatus,
  addNotes,
  updateEnquiry,
} from '../controllers/enquiryController';
import { createTicketFromEnquiry } from '../controllers/ticketController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listEnquiries);
router.get('/:id', authMiddleware, getEnquiry);
router.patch('/:id/status', authMiddleware, staffOrAdmin, updateStatus);
router.patch('/:id/notes', authMiddleware, staffOrAdmin, addNotes);
// Combined update kept for backward compatibility
router.put('/:id', authMiddleware, staffOrAdmin, updateEnquiry);
router.post('/:id/ticket', authMiddleware, staffOrAdmin, createTicketFromEnquiry);

export default router;
