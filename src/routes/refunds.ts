import express from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import {
  listRefunds,
  getRefund,
  createRefund,
  updateRefundStatus,
} from '../controllers/refundController';

const router = express.Router();

router.get('/', authMiddleware, adminOnly, listRefunds);
router.post('/', authMiddleware, adminOnly, createRefund);
router.get('/:id', authMiddleware, adminOnly, getRefund);
router.patch('/:id/status', authMiddleware, adminOnly, updateRefundStatus);

export default router;
