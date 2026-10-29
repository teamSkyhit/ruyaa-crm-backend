import { Router } from 'express';
import {
  listOrders,
  getOrder,
  updateOrderStatus,
  addTracking,
  updateAdminNotes,
  cancelOrder,
  sendOrderReviewRequest,
  refreshOrderTracking,
  bookOrderShipment,
} from '../controllers/orderController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authMiddleware, listOrders);
router.get('/:id', authMiddleware, getOrder);
router.patch('/:id/status', authMiddleware, adminOnly, updateOrderStatus);
router.patch('/:id/tracking', authMiddleware, adminOnly, addTracking);
router.patch('/:id/notes', authMiddleware, adminOnly, updateAdminNotes);
router.patch('/:id/cancel', authMiddleware, adminOnly, cancelOrder);
router.post('/:id/send-review-request', authMiddleware, adminOnly, sendOrderReviewRequest);
router.post('/:id/tracking/refresh', authMiddleware, adminOnly, refreshOrderTracking);
router.post('/:id/shipment', authMiddleware, adminOnly, bookOrderShipment);

export default router;
