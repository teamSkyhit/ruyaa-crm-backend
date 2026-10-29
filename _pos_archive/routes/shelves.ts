// src/routes/shelves.ts
import express from 'express';
import {
  getShelves,
  createShelf,
  updateShelf,
  deleteShelf,
} from '../controllers/shelfController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import { createShelfSchema, updateShelfSchema } from '../validations/schemas';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Shelves
 *   description: Shelf management endpoints
 */

/**
 * @swagger
 * /api/shelves:
 *   get:
 *     summary: Get all shelves
 *     description: Retrieve a list of all shelves with their products
 *     tags: [Shelves]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of shelves retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/', authMiddleware, getShelves);

/**
 * @swagger
 * /api/shelves:
 *   post:
 *     summary: Create a new shelf
 *     description: Create a new shelf (Admin only)
 *     tags: [Shelves]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id
 *               - name
 *             properties:
 *               id:
 *                 type: string
 *                 maxLength: 50
 *                 example: "A1"
 *               name:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Aisle A - Electronics"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Main electronics section"
 *     responses:
 *       201:
 *         description: Shelf created successfully
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/', authMiddleware, adminOnly, validate(createShelfSchema), createShelf);

/**
 * @swagger
 * /api/shelves/{id}:
 *   put:
 *     summary: Update a shelf
 *     description: Update an existing shelf (Admin only)
 *     tags: [Shelves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shelf ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 100
 *               description:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Shelf updated successfully
 *       400:
 *         description: Bad request - Invalid input data
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Shelf not found
 *       500:
 *         description: Internal server error
 */
router.put('/:id', authMiddleware, adminOnly, validate(updateShelfSchema), updateShelf);

/**
 * @swagger
 * /api/shelves/{id}:
 *   delete:
 *     summary: Delete a shelf
 *     description: Delete an existing shelf (Admin only)
 *     tags: [Shelves]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shelf ID
 *     responses:
 *       200:
 *         description: Shelf deleted successfully
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin access required
 *       404:
 *         description: Shelf not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', authMiddleware, adminOnly, deleteShelf);

export default router;
