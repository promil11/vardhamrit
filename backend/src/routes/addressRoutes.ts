import { Router } from 'express';
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
  addressSchema,
  addressParamSchema,
} from '../controllers/addressController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.use(optionalAuthenticate);

router.get('/', getAddresses);
router.post('/', validate({ body: addressSchema }), createAddress);
router.put('/:id', validate({ params: addressParamSchema, body: addressSchema }), updateAddress);
router.delete('/:id', validate({ params: addressParamSchema }), deleteAddress);
router.patch('/:id/default', validate({ params: addressParamSchema }), setDefaultAddress);

export default router;
