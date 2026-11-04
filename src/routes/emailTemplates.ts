import { Router } from 'express';
import { getAll, getOne, create, update, remove } from '../controllers/emailTemplateController';
import { authMiddleware as authenticate, requireRole } from '../middleware/auth';

const router = Router();
const staffOrAdmin = requireRole(['admin', 'user']);

router.get('/', authenticate, getAll);
router.get('/:id', authenticate, getOne);
router.post('/', authenticate, staffOrAdmin, create);
router.put('/:id', authenticate, staffOrAdmin, update);
router.delete('/:id', authenticate, staffOrAdmin, remove);

export default router;
