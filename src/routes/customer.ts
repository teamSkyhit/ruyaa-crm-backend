import { Router } from 'express';
import { requestOtp, verifyOtp, refreshToken, logout } from '../controllers/customerAuthController';
import {
  getProfile,
  updateProfile,
  getOrders,
  getOrderDetail,
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from '../controllers/customerAccountController';
import { customerAuthMiddleware } from '../middleware/customerAuth';

const router = Router();

router.post('/auth/request-otp', requestOtp);
router.post('/auth/verify-otp', verifyOtp);
router.post('/auth/refresh', refreshToken);
router.post('/auth/logout', logout);

router.get('/me', customerAuthMiddleware, getProfile);
router.put('/me', customerAuthMiddleware, updateProfile);
router.get('/orders', customerAuthMiddleware, getOrders);
router.get('/orders/:orderNumber', customerAuthMiddleware, getOrderDetail);
router.get('/addresses', customerAuthMiddleware, getAddresses);
router.post('/addresses', customerAuthMiddleware, createAddress);
router.put('/addresses/:id', customerAuthMiddleware, updateAddress);
router.delete('/addresses/:id', customerAuthMiddleware, deleteAddress);
router.patch('/addresses/:id/set-default', customerAuthMiddleware, setDefaultAddress);
router.get('/wishlist', customerAuthMiddleware, getWishlist);
router.post('/wishlist', customerAuthMiddleware, addToWishlist);
router.delete('/wishlist/:productId', customerAuthMiddleware, removeFromWishlist);

export default router;
