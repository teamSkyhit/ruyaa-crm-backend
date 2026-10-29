import { Router } from 'express';
import { listReviews, updateReviewStatus, deleteReview } from '../controllers/reviewController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, listReviews);
router.patch('/:id/status', authMiddleware, adminOnly, updateReviewStatus);
router.delete('/:id', authMiddleware, adminOnly, deleteReview);

export default router;
