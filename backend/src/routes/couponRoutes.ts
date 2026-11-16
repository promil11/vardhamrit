import { Router } from 'express';
import { checkCoupon, validateCouponSchema, listCoupons } from '../controllers/couponController';
import { optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', optionalAuthenticate, listCoupons);
router.post('/validate', optionalAuthenticate, validate({ body: validateCouponSchema }), checkCoupon);

export default router;
