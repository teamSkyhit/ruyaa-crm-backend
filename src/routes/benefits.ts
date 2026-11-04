import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { listBenefits, createBenefit, updateBenefit, deleteBenefit } from '../controllers/benefitController';

const router = Router({ mergeParams: true });
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authMiddleware, listBenefits);
router.post('/', authMiddleware, staffOrAdmin, createBenefit);
router.put('/:benefitId', authMiddleware, staffOrAdmin, updateBenefit);
router.delete('/:benefitId', authMiddleware, staffOrAdmin, deleteBenefit);

export default router;
