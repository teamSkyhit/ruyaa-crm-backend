import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
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
router.patch('/reorder', authMiddleware, reorderBanners);

router.get('/', authMiddleware, listBanners);
router.post('/', authMiddleware, createBanner);
router.get('/:id', authMiddleware, getBanner);
router.put('/:id', authMiddleware, updateBanner);
router.delete('/:id', authMiddleware, deleteBanner);
router.patch('/:id/toggle', authMiddleware, toggleActive);

export default router;
