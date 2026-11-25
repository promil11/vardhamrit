import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getProductReviews,
  subscribeStockNotification,
  checkStockSubscription,
  getMyStockSubscriptions,
  unsubscribeStockNotification,
  productListQuerySchema,
  productParamSchema,
} from '../controllers/productController';
import { validate } from '../middleware/validate';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

router.get('/', validate({ query: productListQuerySchema }), getProducts);
router.get('/stock-subscription/check', optionalAuthenticate, checkStockSubscription);
router.get('/stock-subscriptions/my-alerts', optionalAuthenticate, getMyStockSubscriptions);
router.delete('/stock-subscriptions/:id', optionalAuthenticate, unsubscribeStockNotification);
router.get('/:id', validate({ params: productParamSchema }), getProductById);
router.get('/:id/reviews', validate({ params: productParamSchema }), getProductReviews);
router.post('/:id/notify-stock', optionalAuthenticate, subscribeStockNotification);

export default router;
