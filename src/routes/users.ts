import express from 'express';
import { listUsers, getUser, createUser, updateUser, deactivateUser, unlockUser } from '../controllers/userController';
import { authMiddleware, adminOnly } from '../middleware/auth';
import validate from '../middleware/validate';
import { createUserSchema, updateUserSchema } from '../validations/schemas';

const router = express.Router();

router.get('/', authMiddleware, adminOnly, listUsers);
router.post('/', authMiddleware, adminOnly, validate(createUserSchema), createUser);
router.get('/:id', authMiddleware, adminOnly, getUser);
router.put('/:id', authMiddleware, adminOnly, validate(updateUserSchema), updateUser);
router.delete('/:id', authMiddleware, adminOnly, deactivateUser);
router.post('/:id/unlock', authMiddleware, adminOnly, unlockUser);

export default router;
