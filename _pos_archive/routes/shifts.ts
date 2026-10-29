import express from 'express';
import {
  openShift,
  closeShift,
  getCurrentShift,
  getAllShifts,
  getShiftById,
} from '../controllers/shiftController';
import { authMiddleware, adminOnly } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /api/shifts:
 *   get:
 *     summary: Get all shifts with filters
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *         description: Filter by store ID
 *       - in: query
 *         name: counterId
 *         schema:
 *           type: string
 *         description: Filter by counter ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [OPEN, CLOSED]
 *         description: Filter by shift status
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter shifts opened from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter shifts opened until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of shifts
 *       401:
 *         description: Unauthorized
 */
router.get('/', authMiddleware, getAllShifts);

/**
 * @swagger
 * /api/shifts/current:
 *   get:
 *     summary: Get current active shift for a counter
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: counterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Counter ID
 *     responses:
 *       200:
 *         description: Current active shift
 *       404:
 *         description: No active shift found
 *       401:
 *         description: Unauthorized
 */
router.get('/current', authMiddleware, getCurrentShift);

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: Get shift by ID with details
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shift ID
 *     responses:
 *       200:
 *         description: Shift details
 *       404:
 *         description: Shift not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authMiddleware, getShiftById);

/**
 * @swagger
 * /api/shifts/open:
 *   post:
 *     summary: Open a new shift for a counter
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - counterId
 *             properties:
 *               counterId:
 *                 type: string
 *                 description: Counter ID
 *               openingBalance:
 *                 type: number
 *                 default: 0
 *                 description: Opening cash balance
 *     responses:
 *       201:
 *         description: Shift opened successfully
 *       400:
 *         description: Bad request (counter ID missing or shift already open)
 *       401:
 *         description: Unauthorized
 */
router.post('/open', authMiddleware, openShift);

/**
 * @swagger
 * /api/shifts/{id}/close:
 *   post:
 *     summary: Close a shift
 *     tags: [Shifts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Shift ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               actualBalance:
 *                 type: number
 *                 description: Actual cash count
 *               notes:
 *                 type: string
 *                 description: Notes about the shift or difference
 *     responses:
 *       200:
 *         description: Shift closed successfully
 *       400:
 *         description: Bad request (shift already closed)
 *       404:
 *         description: Shift not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/close', authMiddleware, closeShift);

export default router;

