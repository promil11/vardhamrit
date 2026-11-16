import { Router } from 'express';
import authRoutes from '../authRoutes';
import productRoutes from '../productRoutes';
import cartRoutes from '../cartRoutes';
import addressRoutes from '../addressRoutes';
import couponRoutes from '../couponRoutes';
import orderRoutes from '../orderRoutes';
import paymentRoutes from '../paymentRoutes';
import reviewRoutes from '../reviewRoutes';
import adminRoutes from '../adminRoutes';

import categoriesRoutes from './categoriesRoutes';
import contentRoutes from './contentRoutes';
import wishlistRoutes from './wishlistRoutes';
import userRoutes from './userRoutes';
import notificationRoutes from '../notificationRoutes';

const router = Router();

// Version 1 Sub-routers
router.use('/auth', authRoutes);
router.use('/categories', categoriesRoutes);
router.use('/content', contentRoutes);
router.use('/products', productRoutes);
router.use('/cart', cartRoutes);
router.use('/addresses', addressRoutes);
router.use('/coupons', couponRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/wishlist', wishlistRoutes);
router.use('/user', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;
