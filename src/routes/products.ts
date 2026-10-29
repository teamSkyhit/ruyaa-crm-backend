// src/routes/products.ts
import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import {
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleWebsiteVisibility,
  updateStock,
} from '../controllers/productController';

const router = Router();

// GET /  — paginated list with filters
router.get('/', authMiddleware, listProducts);

// POST /  — create product
router.post('/', authMiddleware, adminOnly, createProduct);

// GET /:id  — get one with category relation
router.get('/:id', authMiddleware, getProduct);

// PUT /:id  — update any fields
router.put('/:id', authMiddleware, adminOnly, updateProduct);

// DELETE /:id  — delete or deactivate
router.delete('/:id', authMiddleware, adminOnly, deleteProduct);

// PATCH /:id/visibility  — toggle showOnWebsite
router.patch('/:id/visibility', authMiddleware, adminOnly, toggleWebsiteVisibility);

// PATCH /:id/stock  — manual stock update
router.patch('/:id/stock', authMiddleware, adminOnly, updateStock);

export default router;
