import { Router } from 'express';
import {
  placeOrder,
  getOrders,
  getSingleOrder,
  cancelUserOrder,
  handleCalculateDeliveryFees,
  createOrderSchema,
  orderParamSchema,
  cancelOrderSchema,
  calculateFeesSchema,
} from '../controllers/orderController';
import { downloadOrderInvoice } from '../controllers/invoiceController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(optionalAuthenticate);

router.post('/calculate-fees', validate({ body: calculateFeesSchema }), handleCalculateDeliveryFees);
router.post('/', validate({ body: createOrderSchema }), placeOrder);
router.get('/', getOrders);
router.get('/:id', validate({ params: orderParamSchema }), getSingleOrder);
router.get('/:id/invoice', validate({ params: orderParamSchema }), downloadOrderInvoice);
router.post('/:id/cancel', validate({ params: orderParamSchema, body: cancelOrderSchema }), cancelUserOrder);

export default router;
