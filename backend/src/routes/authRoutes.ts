import { Router } from 'express';
import {
  register,
  login,
  refresh,
  getMe,
  updatePushToken,
  verifyInviteCode,
  sendOtp,
  verifyOtp,
  registerSchema,
  loginSchema,
  refreshSchema,
  pushTokenSchema,
  sendOtpSchema,
  verifyOtpSchema,
} from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/verify-invite', verifyInviteCode);
router.post('/verify-invite', verifyInviteCode);
router.post('/send-otp', validate({ body: sendOtpSchema }), sendOtp);
router.post('/verify-otp', validate({ body: verifyOtpSchema }), verifyOtp);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.get('/me', authenticate, getMe);
router.patch('/push-token', authenticate, validate({ body: pushTokenSchema }), updatePushToken);

export default router;
