// src/routes/categories.ts
import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
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

// GET /  — all categories with product count, sorted by sortOrder
router.get('/', authMiddleware, listCategories);

// POST /  — create category
router.post('/', authMiddleware, adminOnly, createCategory);

// PATCH /reorder  — batch sortOrder update (must be before /:id)
router.patch('/reorder', authMiddleware, adminOnly, reorderCategories);

router.get('/:categoryId/subcategories', authMiddleware, listSubcategories);
router.post('/:categoryId/subcategories', authMiddleware, adminOnly, createSubcategory);
router.put('/:categoryId/subcategories/:id', authMiddleware, adminOnly, updateSubcategory);
router.delete('/:categoryId/subcategories/:id', authMiddleware, adminOnly, deleteSubcategory);

// GET /:id  — get one with products[]
router.get('/:id', authMiddleware, getCategory);

// PUT /:id  — update fields
router.put('/:id', authMiddleware, adminOnly, updateCategory);

// DELETE /:id  — delete (only if no products)
router.delete('/:id', authMiddleware, adminOnly, deleteCategory);

export default router;
