import { Router } from 'express';
import { authMiddleware, adminOnly } from '../middleware/auth';
import { listBenefits, createBenefit, updateBenefit, deleteBenefit } from '../controllers/benefitController';

const router = Router({ mergeParams: true });

router.get('/', authMiddleware, listBenefits);
router.post('/', authMiddleware, adminOnly, createBenefit);
router.put('/:benefitId', authMiddleware, adminOnly, updateBenefit);
router.delete('/:benefitId', authMiddleware, adminOnly, deleteBenefit);

export default router;
