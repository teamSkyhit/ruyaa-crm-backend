import express from 'express';

// Auth & Users
import authRoutes from './auth';
import userRoutes from './users';

// Catalogue
import productRoutes from './products';
import variantRoutes from './variants';
import benefitRoutes from './benefits';
import mediaRoutes from './media';
import highlightRoutes from './highlights';
import relatedProductRoutes from './relatedProducts';
import packCardRoutes from './packCards';
import blogRoutes from './blogs';
import categoryRoutes from './categories';
import uploadRoutes from './upload';

// Orders & Customers
import orderRoutes from './orders';
import notificationRoutes from './notifications';
import ticketRoutes from './tickets';
import customerRoutes from './customers';
import refundRoutes from './refunds';

// Content & Settings
import siteSettingsRoutes from './siteSettings';
import systemConfigRoutes from './systemConfig';
import bannerRoutes from './banners';
import enquiryRoutes from './enquiries';
import newsletterRoutes from './newsletter';

// Marketing & Promotions
import faqRoutes from './faqs';
import discountRoutes from './discounts';
import reviewRoutes from './reviews';

// CRM Internals
import dashboardRoutes from './dashboard';
import activityRoutes from './activity';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);

router.use('/products/:productId/variants', variantRoutes);
router.use('/products/:productId/benefits', benefitRoutes);
router.use('/products/:productId/media', mediaRoutes);
router.use('/products/:productId/highlights', highlightRoutes);
router.use('/products/:productId/related', relatedProductRoutes);
router.use('/products', productRoutes);
router.use('/pack-cards', packCardRoutes);
router.use('/blogs', blogRoutes);
router.use('/categories', categoryRoutes);
router.use('/upload', uploadRoutes);

router.use('/orders', orderRoutes);
router.use('/notifications', notificationRoutes);
router.use('/tickets', ticketRoutes);
router.use('/customers', customerRoutes);
router.use('/refunds', refundRoutes);

router.use('/site-settings', siteSettingsRoutes);
router.use('/system-config', systemConfigRoutes);
router.use('/banners', bannerRoutes);
router.use('/enquiries', enquiryRoutes);
router.use('/newsletter', newsletterRoutes);

router.use('/faqs', faqRoutes);
router.use('/discounts', discountRoutes);
router.use('/reviews', reviewRoutes);

router.use('/dashboard', dashboardRoutes);
router.use('/activity', activityRoutes);

router.get('/', (_req, res) => res.json({ message: 'Ruyaa Essentials API', status: 'ok' }));

export default router;
