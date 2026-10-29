import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import {
  listBanners,
  getBanner,
  createBanner,
  updateBanner,
  deleteBanner,
  reorderBanners,
  toggleActive,
} from '../controllers/bannerController';

const router = Router();

// /reorder must come before /:id to avoid "reorder" being parsed as an id
router.patch('/reorder', authMiddleware, adminOnly, reorderBanners);

router.get('/', authMiddleware, listBanners);
router.post('/', authMiddleware, adminOnly, createBanner);
router.get('/:id', authMiddleware, getBanner);
router.put('/:id', authMiddleware, adminOnly, updateBanner);
router.delete('/:id', authMiddleware, adminOnly, deleteBanner);
router.patch('/:id/toggle', authMiddleware, adminOnly, toggleActive);

export default router;
