import { Router } from 'express';
import {
  getProducts,
  getProductById,
  getProductReviews,
  productListQuerySchema,
  productParamSchema,
} from '../controllers/productController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', validate({ query: productListQuerySchema }), getProducts);
router.get('/:id', validate({ params: productParamSchema }), getProductById);
router.get('/:id/reviews', validate({ params: productParamSchema }), getProductReviews);

export default router;
