import express from 'express';
import { login, refresh, logout, getMe, changePassword, forgotPassword, resetPassword } from '../controllers/authController';
import { authMiddleware } from '../middleware/auth';
import validate from '../middleware/validate';
import { loginSchema, changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../validations/schemas';
import { authLimiter, forgotPasswordLimiter, resetPasswordLimiter } from '../middleware/rateLimiter';

const router = express.Router();

router.post('/login', authLimiter, validate(loginSchema), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authMiddleware, getMe);
router.post('/change-password', authMiddleware, validate(changePasswordSchema), changePassword);
router.post('/forgot-password', forgotPasswordLimiter, validate(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(resetPasswordSchema), resetPassword);

export default router;
