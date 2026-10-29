// src/routes/stockTransfers.ts
import express from 'express';
const router = express.Router();
import {
  getAllStockTransfers,
  getStockTransferById,
  requestStockTransfer,
  approveStockTransfer,
  shipStockTransfer,
  receiveStockTransfer,
  cancelStockTransfer,
} from '../controllers/stockTransferController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  requestStockTransferSchema,
  approveStockTransferSchema,
  shipStockTransferSchema,
  receiveStockTransferSchema,
  cancelStockTransferSchema,
} from '../validations/schemas';

/**
 * @swagger
 * tags:
 *   name: Stock Transfers
 *   description: Stock transfer management endpoints for transferring inventory between stores
 */

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/stock-transfers:
 *   get:
 *     summary: Get all stock transfers
 *     description: Retrieve a list of all stock transfers with optional filters
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter transfers by store (source or destination)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, IN_TRANSIT, RECEIVED, CANCELLED]
 *         description: Filter transfers by status
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter transfers by product ID
 *     responses:
 *       200:
 *         description: List of stock transfers retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', getAllStockTransfers);

/**
 * @swagger
 * /api/stock-transfers/{id}:
 *   get:
 *     summary: Get stock transfer by ID
 *     description: Retrieve detailed information about a specific stock transfer
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Stock transfer ID
 *     responses:
 *       200:
 *         description: Stock transfer details retrieved successfully
 *       404:
 *         description: Stock transfer not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getStockTransferById);

/**
 * @swagger
 * /api/stock-transfers/request:
 *   post:
 *     summary: Request a stock transfer
 *     description: Create a new stock transfer request from one store to another
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fromStoreId
 *               - toStoreId
 *               - productId
 *               - quantity
 *             properties:
 *               fromStoreId:
 *                 type: string
 *                 format: uuid
 *                 description: Source store ID
 *               toStoreId:
 *                 type: string
 *                 format: uuid
 *                 description: Destination store ID
 *               productId:
 *                 type: string
 *                 format: uuid
 *                 description: Product ID to transfer
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 description: Quantity to transfer
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Optional notes about the transfer
 *     responses:
 *       201:
 *         description: Stock transfer requested successfully
 *       400:
 *         description: Invalid request (insufficient stock, same store, etc.)
 *       404:
 *         description: Store or product not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/request',
  validate(requestStockTransferSchema),
  requestStockTransfer
);

/**
 * @swagger
 * /api/stock-transfers/{id}/approve:
 *   post:
 *     summary: Approve a stock transfer
 *     description: Approve a pending stock transfer (Admin/Manager only)
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Stock transfer ID
 *     responses:
 *       200:
 *         description: Stock transfer approved successfully
 *       400:
 *         description: Transfer cannot be approved (wrong status)
 *       404:
 *         description: Stock transfer not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/:id/approve',
  adminOnly,
  validate(approveStockTransferSchema),
  approveStockTransfer
);

/**
 * @swagger
 * /api/stock-transfers/{id}/ship:
 *   post:
 *     summary: Ship a stock transfer
 *     description: Mark stock transfer as shipped and deduct from source store inventory
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Stock transfer ID
 *     responses:
 *       200:
 *         description: Stock transfer shipped successfully
 *       400:
 *         description: Transfer cannot be shipped (wrong status or insufficient stock)
 *       404:
 *         description: Stock transfer not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/ship',
  validate(shipStockTransferSchema),
  shipStockTransfer
);

/**
 * @swagger
 * /api/stock-transfers/{id}/receive:
 *   post:
 *     summary: Receive a stock transfer
 *     description: Mark stock transfer as received and add to destination store inventory
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Stock transfer ID
 *     responses:
 *       200:
 *         description: Stock transfer received successfully
 *       400:
 *         description: Transfer cannot be received (wrong status)
 *       404:
 *         description: Stock transfer not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/receive',
  validate(receiveStockTransferSchema),
  receiveStockTransfer
);

/**
 * @swagger
 * /api/stock-transfers/{id}/cancel:
 *   post:
 *     summary: Cancel a stock transfer
 *     description: Cancel a pending or in-transit stock transfer and release reserved quantity
 *     tags: [Stock Transfers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Stock transfer ID
 *     responses:
 *       200:
 *         description: Stock transfer cancelled successfully
 *       400:
 *         description: Transfer cannot be cancelled (already received or cancelled)
 *       404:
 *         description: Stock transfer not found
 *       401:
 *         description: Unauthorized
 */
router.post(
  '/:id/cancel',
  validate(cancelStockTransferSchema),
  cancelStockTransfer
);

export default router;

