import express from 'express';
import {
  getSalesReport,
  getGstReport,
  getPaymentModeReport,
  getInventoryReport,
  getCashReconciliationReport,
  getCounterWiseReport,
  getRecentBills,
} from '../controllers/reportController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Get sales report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: counterId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sales report data
 */
router.get('/sales', authMiddleware, getSalesReport);
router.get('/recent-bills', authMiddleware, getRecentBills);

/**
 * @swagger
 * /api/reports/gst:
 *   get:
 *     summary: Get GST report (GSTR-1 format, HSN-wise)
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: GST report data
 */
router.get('/gst', authMiddleware, getGstReport);

/**
 * @swagger
 * /api/reports/payment-mode:
 *   get:
 *     summary: Get payment mode report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: counterId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment mode report data
 */
router.get('/payment-mode', authMiddleware, getPaymentModeReport);

/**
 * @swagger
 * /api/reports/inventory:
 *   get:
 *     summary: Get inventory report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Inventory report data
 */
router.get('/inventory', authMiddleware, getInventoryReport);

/**
 * @swagger
 * /api/reports/cash-reconciliation:
 *   get:
 *     summary: Get cash reconciliation report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *       - in: query
 *         name: counterId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cash reconciliation report data
 */
router.get('/cash-reconciliation', authMiddleware, getCashReconciliationReport);

/**
 * @swagger
 * /api/reports/counter-wise:
 *   get:
 *     summary: Get counter-wise report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Counter-wise report data
 */
router.get('/counter-wise', authMiddleware, getCounterWiseReport);

export default router;

