import { Router } from 'express';
import {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  syncCart,
  addToCartSchema,
  updateCartItemSchema,
  cartItemParamSchema,
  syncCartSchema,
} from '../controllers/cartController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(authenticate);

router.get('/', getCart);
router.post('/', validate({ body: addToCartSchema }), addToCart);
router.post('/sync', validate({ body: syncCartSchema }), syncCart);
router.patch('/:id', validate({ params: cartItemParamSchema, body: updateCartItemSchema }), updateCartItem);
router.delete('/:id', validate({ params: cartItemParamSchema }), removeCartItem);
router.delete('/', clearCart);

export default router;
