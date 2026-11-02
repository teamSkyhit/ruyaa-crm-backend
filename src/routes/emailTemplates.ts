import { Router } from 'express';
import { getAll, getOne, create, update, remove } from '../controllers/emailTemplateController';
import { authMiddleware as authenticate, adminOnly } from '../middleware/auth';

const router = Router();

router.get('/', authenticate, adminOnly, getAll);
router.get('/:id', authenticate, adminOnly, getOne);
router.post('/', authenticate, adminOnly, create);
router.put('/:id', authenticate, adminOnly, update);
router.delete('/:id', authenticate, adminOnly, remove);

export default router;
