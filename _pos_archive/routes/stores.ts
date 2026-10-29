// src/routes/stores.ts
import express from 'express';
const router = express.Router();
import {
  getAllStores,
  getStoreById,
  createStore,
  updateStore,
  deleteStore,
} from '../controllers/storeController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createStoreSchema,
  updateStoreSchema,
  deleteStoreSchema,
} from '../validations/schemas';

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: Store management endpoints for multi-store support
 */

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/stores:
 *   get:
 *     summary: Get all stores
 *     description: Retrieve a list of all stores with their counters, users, and sales counts
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of stores retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Store'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getAllStores);

/**
 * @swagger
 * /api/stores/{id}:
 *   get:
 *     summary: Get store by ID
 *     description: Retrieve detailed information about a specific store including counters and users
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *     responses:
 *       200:
 *         description: Store details retrieved successfully
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getStoreById);

/**
 * @swagger
 * /api/stores:
 *   post:
 *     summary: Create a new store
 *     description: Create a new store with details like name, GSTIN, address, etc. (Admin only)
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Main Store"
 *               code:
 *                 type: string
 *                 maxLength: 50
 *                 example: "STORE-001"
 *               gstin:
 *                 type: string
 *                 maxLength: 15
 *                 example: "29ABCDE1234F1Z5"
 *               address:
 *                 type: string
 *                 example: "123 Main Street"
 *               city:
 *                 type: string
 *                 example: "Bangalore"
 *               state:
 *                 type: string
 *                 example: "Karnataka"
 *               pincode:
 *                 type: string
 *                 example: "560001"
 *               contact:
 *                 type: string
 *                 example: "+91-9876543210"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "store@example.com"
 *               website:
 *                 type: string
 *                 format: uri
 *                 example: "https://store.example.com"
 *               logoUrl:
 *                 type: string
 *                 example: "https://example.com/logo.png"
 *               isActive:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       201:
 *         description: Store created successfully
 *       400:
 *         description: Store with this name or code already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/',
  adminOnly,
  validate(createStoreSchema),
  createStore
);

/**
 * @swagger
 * /api/stores/{id}:
 *   put:
 *     summary: Update a store
 *     description: Update store details (Admin only)
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               code:
 *                 type: string
 *               gstin:
 *                 type: string
 *               address:
 *                 type: string
 *               city:
 *                 type: string
 *               state:
 *                 type: string
 *               pincode:
 *                 type: string
 *               contact:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               website:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Store updated successfully
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put(
  '/:id',
  adminOnly,
  validate(updateStoreSchema),
  updateStore
);

/**
 * @swagger
 * /api/stores/{id}:
 *   delete:
 *     summary: Delete a store
 *     description: Delete a store. Cannot delete if store has sales, counters, or users (Admin only)
 *     tags: [Stores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Store ID
 *     responses:
 *       200:
 *         description: Store deleted successfully
 *       400:
 *         description: Cannot delete store with existing sales, counters, or users
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete(
  '/:id',
  adminOnly,
  validate(deleteStoreSchema),
  deleteStore
);

export default router;

