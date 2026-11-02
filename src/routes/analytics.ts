import { Router } from 'express';
import { getSummary, getRevenue, getTopProducts, getOrdersByStatus } from '../controllers/analyticsController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/summary', authMiddleware, adminOnly, getSummary);
router.get('/revenue', authMiddleware, adminOnly, getRevenue);
router.get('/top-products', authMiddleware, adminOnly, getTopProducts);
router.get('/orders-by-status', authMiddleware, adminOnly, getOrdersByStatus);

export default router;
