import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
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

router.get('/', authMiddleware, listBlogs);
router.get('/:id', authMiddleware, getBlog);
router.post('/', authMiddleware, adminOnly, createBlog);
router.put('/:id', authMiddleware, adminOnly, updateBlog);
router.patch('/:id/publish', authMiddleware, adminOnly, publishBlog);
router.patch('/:id/unpublish', authMiddleware, adminOnly, unpublishBlog);
router.delete('/:id', authMiddleware, adminOnly, deleteBlog);

export default router;
