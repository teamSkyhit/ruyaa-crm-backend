import express from 'express';
import {
  getSiteSettings,
  getBanners,
  getProducts,
  getProductBySlug,
  getCategories,
  createOrder,
  verifyPayment,
  trackOrder,
  createEnquiry,
  subscribeNewsletter,
  handleRazorpayWebhook,
  getFaqs,
  validateDiscount,
  checkPincode,
} from '../controllers/publicController';
import { listPublicBlogs, getPublicBlog } from '../controllers/blogController';
import { submitReview, getProductReviews } from '../controllers/reviewController';
import { createTicket, getPublicTicket } from '../controllers/ticketController';
import { publicOrderLimiter, publicLeadLimiter, publicTrackLimiter, publicReadLimiter } from '../middleware/rateLimiter';
import { publicReadCache } from '../middleware/publicReadCache';

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.includes('/orders/track') && !req.path.includes('/tickets/')) {
    return publicReadLimiter(req, res, next);
  }
  next();
});
router.use(publicReadCache);

router.get('/site-settings', getSiteSettings);
router.get('/banners', getBanners);
router.get('/products', getProducts);
router.get('/products/:slug', getProductBySlug);
router.get('/categories', getCategories);

router.post('/orders', publicOrderLimiter, createOrder);
router.post('/orders/verify-payment', publicOrderLimiter, verifyPayment);
router.get('/orders/track/:orderNumber', publicTrackLimiter, trackOrder);

router.get('/pincode/:pincode', checkPincode);

router.get('/blogs', listPublicBlogs);
router.get('/blogs/:slug', getPublicBlog);

router.get('/faqs', getFaqs);
router.post('/discount/validate', publicOrderLimiter, validateDiscount);
router.post('/reviews', publicLeadLimiter, submitReview);
router.get('/reviews/:productSlug', getProductReviews);

router.post('/enquiries', publicLeadLimiter, createEnquiry);
router.post('/tickets', publicLeadLimiter, createTicket);
router.get('/tickets/:ticketNumber', publicTrackLimiter, getPublicTicket);
router.post('/newsletter', publicLeadLimiter, subscribeNewsletter);

// Razorpay webhook: express.raw is applied ONLY to this route so the raw body
// is preserved for HMAC signature verification. The global express.json() on
// the app would otherwise consume the buffer before this handler runs.
router.post(
  '/webhook/razorpay',
  express.raw({ type: 'application/json' }),
  handleRazorpayWebhook
);

export default router;
