// src/routes/storeInventory.ts
import express from 'express';
const router = express.Router();
import {
  getStoreInventory,
  getProductInventoryAcrossStores,
  updateStoreInventory,
  getStoreInventorySummary,
} from '../controllers/storeInventoryController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import { updateStoreInventorySchema } from '../validations/schemas';

/**
 * @swagger
 * tags:
 *   name: Store Inventory
 *   description: Store-level inventory management endpoints
 */

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/store-inventory/store/{storeId}:
 *   get:
 *     summary: Get inventory for a specific store
 *     description: Retrieve all products and their quantities for a specific store
 *     tags: [Store Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *       - in: query
 *         name: lowStock
 *         schema:
 *           type: boolean
 *         description: Filter to show only low stock items
 *     responses:
 *       200:
 *         description: Store inventory retrieved successfully
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 */
router.get('/store/:storeId', getStoreInventory);

/**
 * @swagger
 * /api/store-inventory/store/{storeId}/summary:
 *   get:
 *     summary: Get inventory summary for a store
 *     description: Get aggregated inventory statistics for a store
 *     tags: [Store Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *     responses:
 *       200:
 *         description: Inventory summary retrieved successfully
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 */
router.get('/store/:storeId/summary', getStoreInventorySummary);

/**
 * @swagger
 * /api/store-inventory/product/{productId}:
 *   get:
 *     summary: Get inventory for a product across all stores
 *     description: Retrieve inventory quantities for a specific product in all stores
 *     tags: [Store Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product inventory across stores retrieved successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.get('/product/:productId', getProductInventoryAcrossStores);

/**
 * @swagger
 * /api/store-inventory/store/{storeId}/product/{productId}:
 *   put:
 *     summary: Update store inventory
 *     description: Manually adjust inventory quantity or min stock level for a product in a store (Admin only)
 *     tags: [Store Inventory]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: storeId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 0
 *                 description: New inventory quantity
 *               minStockLevel:
 *                 type: integer
 *                 minimum: 0
 *                 description: Override minimum stock level for this store
 *     responses:
 *       200:
 *         description: Store inventory updated successfully
 *       404:
 *         description: Store or product not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put(
  '/store/:storeId/product/:productId',
  adminOnly,
  validate(updateStoreInventorySchema),
  updateStoreInventory
);

export default router;

