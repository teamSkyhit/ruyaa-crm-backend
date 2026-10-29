import express from 'express';
import {
  createPayment,
  getPaymentsBySale,
  deletePayment,
} from '../controllers/paymentController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/payments/sale/{saleId}:
 *   get:
 *     summary: Get all payments for a sale
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: saleId
 *         required: true
 *         schema:
 *           type: string
 *         description: Sale ID
 *     responses:
 *       200:
 *         description: List of payments
 *       401:
 *         description: Unauthorized
 */
router.get('/sale/:saleId', authMiddleware, getPaymentsBySale);

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment for a sale
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - saleId
 *               - method
 *               - amount
 *             properties:
 *               saleId:
 *                 type: string
 *                 description: Sale ID
 *               method:
 *                 type: string
 *                 enum: [CASH, UPI, CARD, WALLET]
 *                 description: Payment method
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               transactionId:
 *                 type: string
 *                 description: Transaction ID for UPI/Card payments
 *               notes:
 *                 type: string
 *                 description: Optional notes
 *     responses:
 *       201:
 *         description: Payment created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/', authMiddleware, createPayment);

/**
 * @swagger
 * /api/payments/{id}:
 *   delete:
 *     summary: Delete a payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment deleted successfully
 *       404:
 *         description: Payment not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authMiddleware, deletePayment);

export default router;

