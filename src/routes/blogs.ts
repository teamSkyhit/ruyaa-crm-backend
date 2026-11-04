import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import {
  listBlogs,
  getBlog,
  createBlog,
  updateBlog,
  publishBlog,
  unpublishBlog,
  deleteBlog,
} from '../controllers/blogController';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listBlogs);
router.get('/:id', authMiddleware, getBlog);
router.post('/', authMiddleware, staffOrAdmin, createBlog);
router.put('/:id', authMiddleware, staffOrAdmin, updateBlog);
router.patch('/:id/publish', authMiddleware, staffOrAdmin, publishBlog);
router.patch('/:id/unpublish', authMiddleware, staffOrAdmin, unpublishBlog);
router.delete('/:id', authMiddleware, staffOrAdmin, deleteBlog);

export default router;
