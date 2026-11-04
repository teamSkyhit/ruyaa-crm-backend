import { Router } from 'express';
import { getSummary, getRevenue, getTopProducts, getOrdersByStatus } from '../controllers/analyticsController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/summary', authMiddleware, staffOrAdmin, getSummary);
router.get('/revenue', authMiddleware, staffOrAdmin, getRevenue);
router.get('/top-products', authMiddleware, staffOrAdmin, getTopProducts);
router.get('/orders-by-status', authMiddleware, staffOrAdmin, getOrdersByStatus);

export default router;
