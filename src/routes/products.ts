// src/routes/products.ts
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleWebsiteVisibility,
  toggleActive,
  updateStock,
} from '../controllers/productController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

// GET /  — paginated list with filters
router.get('/', authMiddleware, listProducts);

// POST /  — create product
router.post('/', authMiddleware, staffOrAdmin, createProduct);

// GET /:id  — get one with category relation
router.get('/:id', authMiddleware, getProduct);

// PUT /:id  — update any fields
router.put('/:id', authMiddleware, staffOrAdmin, updateProduct);

// DELETE /:id  — delete or deactivate
router.delete('/:id', authMiddleware, staffOrAdmin, deleteProduct);

// PATCH /:id/toggle-active  — toggle isActive
router.patch('/:id/toggle-active', authMiddleware, staffOrAdmin, toggleActive);

// PATCH /:id/visibility  — toggle showOnWebsite
router.patch('/:id/visibility', authMiddleware, staffOrAdmin, toggleWebsiteVisibility);

// PATCH /:id/stock  — manual stock update
router.patch('/:id/stock', authMiddleware, staffOrAdmin, updateStock);

export default router;
