import { Router } from 'express';
import { listReviews, updateReviewStatus, deleteReview } from '../controllers/reviewController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listReviews);
router.patch('/:id/status', authMiddleware, staffOrAdmin, updateReviewStatus);
router.delete('/:id', authMiddleware, staffOrAdmin, deleteReview);

export default router;
