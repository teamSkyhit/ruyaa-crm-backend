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
  downloadInvoice,
  sendInvoiceEmail,
  createPosOrder,
} from '../controllers/orderController';
import { authMiddleware, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.post('/', authMiddleware, staffOrAdmin, createPosOrder);
router.get('/', authMiddleware, listOrders);
router.get('/:id', authMiddleware, getOrder);
router.patch('/:id/status', authMiddleware, staffOrAdmin, updateOrderStatus);
router.patch('/:id/tracking', authMiddleware, staffOrAdmin, addTracking);
router.patch('/:id/notes', authMiddleware, staffOrAdmin, updateAdminNotes);
router.patch('/:id/cancel', authMiddleware, staffOrAdmin, cancelOrder);
router.post('/:id/send-review-request', authMiddleware, staffOrAdmin, sendOrderReviewRequest);
router.post('/:id/tracking/refresh', authMiddleware, staffOrAdmin, refreshOrderTracking);
router.post('/:id/shipment', authMiddleware, staffOrAdmin, bookOrderShipment);
router.get('/:id/invoice', authMiddleware, staffOrAdmin, downloadInvoice);
router.post('/:id/send-invoice', authMiddleware, staffOrAdmin, sendInvoiceEmail);

export default router;
