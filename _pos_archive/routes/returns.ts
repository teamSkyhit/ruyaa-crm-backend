import express from 'express';
import {
  getAllReturns,
  getReturnById,
  searchReturnsByReceipt,
  createReturn,
} from '../controllers/returnController';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/returns:
 *   get:
 *     summary: Get all returns
 *     tags: [Returns]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, PROCESSED, CANCELLED]
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of returns
 */
router.get('/', authMiddleware, getAllReturns);

/**
 * @swagger
 * /api/returns/search:
 *   get:
 *     summary: Search returns by receipt number
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: receiptNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Sale details with return status
 *       404:
 *         description: Sale not found
 */
router.get('/search', authMiddleware, searchReturnsByReceipt);

/**
 * @swagger
 * /api/returns/{id}:
 *   get:
 *     summary: Get return by ID
 *     tags: [Returns]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Return details
 *       404:
 *         description: Return not found
 */
router.get('/:id', authMiddleware, getReturnById);

/**
 * @swagger
 * /api/returns:
 *   post:
 *     summary: Create a return/exchange
 *     tags: [Returns]
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
 *               - quantity
 *               - reason
 *             properties:
 *               saleId:
 *                 type: string
 *                 format: uuid
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               reason:
 *                 type: string
 *                 enum: [DEFECTIVE, WRONG_ITEM, CUSTOMER_REQUEST, OTHER]
 *               reasonDetails:
 *                 type: string
 *               isExchange:
 *                 type: boolean
 *                 default: false
 *               exchangeProductId:
 *                 type: string
 *                 format: uuid
 *               exchangeQuantity:
 *                 type: integer
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Return processed successfully
 *       400:
 *         description: Bad request (return period expired, invalid quantity, etc.)
 */
router.post('/', authMiddleware, createReturn);

export default router;

