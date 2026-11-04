// src/routes/categories.ts
import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from '../controllers/categoryController';
import {
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '../controllers/subcategoryController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

// GET /  — all categories with product count, sorted by sortOrder
router.get('/', authMiddleware, listCategories);

// POST /  — create category
router.post('/', authMiddleware, staffOrAdmin, createCategory);

// PATCH /reorder  — batch sortOrder update (must be before /:id)
router.patch('/reorder', authMiddleware, staffOrAdmin, reorderCategories);

router.get('/:categoryId/subcategories', authMiddleware, listSubcategories);
router.post('/:categoryId/subcategories', authMiddleware, staffOrAdmin, createSubcategory);
router.put('/:categoryId/subcategories/:id', authMiddleware, staffOrAdmin, updateSubcategory);
router.delete('/:categoryId/subcategories/:id', authMiddleware, staffOrAdmin, deleteSubcategory);

// GET /:id  — get one with products[]
router.get('/:id', authMiddleware, getCategory);

// PUT /:id  — update fields
router.put('/:id', authMiddleware, staffOrAdmin, updateCategory);

// DELETE /:id  — delete (only if no products)
router.delete('/:id', authMiddleware, staffOrAdmin, deleteCategory);

export default router;
