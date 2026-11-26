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
  sendEmailOtp,
  verifyEmailOtp,
  registerSchema,
  loginSchema,
  refreshSchema,
  pushTokenSchema,
  sendOtpSchema,
  verifyOtpSchema,
  sendEmailOtpSchema,
  verifyEmailOtpSchema,
  firebasePhoneLogin,
  completeTour,
} from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { updateUserProfile, uploadAvatar, avatarUploadMiddleware } from '../controllers/userController';

const router = Router();

router.get('/verify-invite', verifyInviteCode);
router.post('/verify-invite', verifyInviteCode);
router.post('/send-otp', validate({ body: sendOtpSchema }), sendOtp);
router.post('/verify-otp', validate({ body: verifyOtpSchema }), verifyOtp);
router.post('/firebase-login', firebasePhoneLogin);
router.post('/send-email-otp', validate({ body: sendEmailOtpSchema }), sendEmailOtp);
router.post('/verify-email-otp', validate({ body: verifyEmailOtpSchema }), verifyEmailOtp);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/avatar', optionalAuthenticate, avatarUploadMiddleware, uploadAvatar);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.get('/me', authenticate, getMe);
router.post('/complete-tour', authenticate, completeTour);
router.put('/profile', authenticate, updateUserProfile);
router.patch('/profile', authenticate, updateUserProfile);
router.patch('/push-token', authenticate, validate({ body: pushTokenSchema }), updatePushToken);

export default router;
