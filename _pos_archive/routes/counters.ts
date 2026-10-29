// src/routes/counters.ts
import express from 'express';
const router = express.Router();
import {
  getAllCounters,
  getCounterById,
  createCounter,
  updateCounter,
  deleteCounter,
} from '../controllers/counterController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import {
  createCounterSchema,
  updateCounterSchema,
  deleteCounterSchema,
} from '../validations/schemas';

/**
 * @swagger
 * tags:
 *   name: Counters
 *   description: Counter management endpoints for store billing counters
 */

// GET /counters is public (needed by POS device setup before login)
/**
 * @swagger
 * /api/counters:
 *   get:
 *     summary: Get all counters
 *     description: Retrieve a list of all counters, optionally filtered by storeId. Public endpoint for device setup.
 *     tags: [Counters]
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter counters by store ID
 *     responses:
 *       200:
 *         description: List of counters retrieved successfully
 */
router.get('/', getAllCounters);

// All remaining routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * /api/counters/{id}:
 *   get:
 *     summary: Get counter by ID
 *     description: Retrieve detailed information about a specific counter
 *     tags: [Counters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Counter ID
 *     responses:
 *       200:
 *         description: Counter details retrieved successfully
 *       404:
 *         description: Counter not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', getCounterById);

/**
 * @swagger
 * /api/counters:
 *   post:
 *     summary: Create a new counter
 *     description: Create a new counter for a store (Admin only)
 *     tags: [Counters]
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
 *               - storeId
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Main Billing Counter"
 *               storeId:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       201:
 *         description: Counter created successfully
 *       400:
 *         description: Counter with this name already exists in this store
 *       404:
 *         description: Store not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.post(
  '/',
  adminOnly,
  validate(createCounterSchema),
  createCounter
);

/**
 * @swagger
 * /api/counters/{id}:
 *   put:
 *     summary: Update a counter
 *     description: Update counter details (Admin only)
 *     tags: [Counters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Counter ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               storeId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Counter updated successfully
 *       404:
 *         description: Counter or store not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put(
  '/:id',
  adminOnly,
  validate(updateCounterSchema),
  updateCounter
);

/**
 * @swagger
 * /api/counters/{id}:
 *   delete:
 *     summary: Delete a counter
 *     description: Delete a counter. Cannot delete if counter has sales (Admin only)
 *     tags: [Counters]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Counter ID
 *     responses:
 *       200:
 *         description: Counter deleted successfully
 *       400:
 *         description: Cannot delete counter with existing sales
 *       404:
 *         description: Counter not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete(
  '/:id',
  adminOnly,
  validate(deleteCounterSchema),
  deleteCounter
);

export default router;

