import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
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

const staffOrAdmin = requireRole(['admin', 'user']);

// /reorder must come before /:id to avoid "reorder" being parsed as an id
router.patch('/reorder', authMiddleware, staffOrAdmin, reorderBanners);

router.get('/', authMiddleware, listBanners);
router.post('/', authMiddleware, staffOrAdmin, createBanner);
router.get('/:id', authMiddleware, getBanner);
router.put('/:id', authMiddleware, staffOrAdmin, updateBanner);
router.delete('/:id', authMiddleware, staffOrAdmin, deleteBanner);
router.patch('/:id/toggle', authMiddleware, staffOrAdmin, toggleActive);

export default router;
