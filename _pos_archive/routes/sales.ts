// src/routes/sales.ts
import express from 'express';
import {
  getAllSales,
  getSaleById,
  getReceiptByNumber,
  getCustomerByPhone,
  createSale,
  updateSale,
} from '../controllers/saleController';
import { authMiddleware } from '../middleware/auth';
import { validateUUID } from '../middleware/validateUUID';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Sales management endpoints
 */

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales
 *     description: Retrieve a list of all sales with product and user information
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of sales retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', authMiddleware, getAllSales);

/**
 * @swagger
 * /api/sales/receipt/{saleNumber}:
 *   get:
 *     summary: Get receipt by sale number
 *     description: Retrieve a complete receipt with all items grouped by sale number
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: saleNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Receipt number (e.g., RCP-000001)
 *     responses:
 *       200:
 *         description: Receipt retrieved successfully
 *       404:
 *         description: Receipt not found
 */
router.get('/customer-lookup', authMiddleware, getCustomerByPhone);
router.get('/receipt/:saleNumber', authMiddleware, getReceiptByNumber);

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     summary: Get sale by ID
 *     description: Retrieve a single sale by its ID
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sale retrieved successfully
 *       404:
 *         description: Sale not found
 */
router.get('/:id', authMiddleware, validateUUID('id'), getSaleById);

/**
 * @swagger
 * /api/sales:
 *   post:
 *     summary: Create a new sale with multiple items
 *     description: Record a new sale with multiple products, discounts, GST calculation, and split payments
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *               - storeId
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - productId
 *                     - quantity
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *                     discountPercent:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Discount percentage (5, 10, etc.)
 *                     discountAmount:
 *                       type: number
 *                       minimum: 0
 *                       description: Fixed discount amount (manual discount)
 *               storeId:
 *                 type: string
 *                 format: uuid
 *               counterId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional counter ID
 *               shiftId:
 *                 type: string
 *                 format: uuid
 *                 description: Optional shift ID
 *               withoutGst:
 *                 type: boolean
 *                 default: false
 *                 description: Flag for "without GST" bills
 *               customerName:
 *                 type: string
 *               customerPhone:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *               payments:
 *                 type: array
 *                 description: Split payments (optional)
 *                 items:
 *                   type: object
 *                   required:
 *                     - method
 *                     - amount
 *                   properties:
 *                     method:
 *                       type: string
 *                       enum: [CASH, UPI, CARD, WALLET]
 *                     amount:
 *                       type: number
 *                       minimum: 0
 *                     transactionId:
 *                       type: string
 *                       description: Transaction ID for UPI/Card payments
 *                     notes:
 *                       type: string
 *     responses:
 *       201:
 *         description: Sale created successfully
 *       400:
 *         description: Bad request - Invalid input data or insufficient stock
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Store/Counter/Shift/Product not found
 *       500:
 *         description: Internal server error
 */
router.post('/', authMiddleware, createSale);

/**
 * @swagger
 * /api/sales/update:
 *   post:
 *     summary: Update sale (legacy endpoint)
 *     description: Record a product sale and update inventory (legacy endpoint for compatibility)
 *     tags: [Sales]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productId
 *               - quantity
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 5
 *     responses:
 *       200:
 *         description: Sale updated successfully
 *       400:
 *         description: Bad request - Invalid input data or insufficient stock
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: Product not found
 *       500:
 *         description: Internal server error
 */
router.post('/update', authMiddleware, updateSale);

export default router;
