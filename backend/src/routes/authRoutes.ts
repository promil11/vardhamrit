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
} from '../controllers/authController';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { updateUserProfile } from '../controllers/userController';
import { sendOtpEmail } from '../services/emailService';

const router = Router();

router.get('/test-email-dispatch', async (req, res) => {
  const to = String(req.query.to || 'promiljain11@gmail.com');
  try {
    const result = await sendOtpEmail({
      to,
      otp: '778899',
      userName: 'Vardhamrit Tester',
      purpose: 'Diagnostics Test',
    });
    return res.json({ success: true, to, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, to, error: err.message });
  }
});

router.get('/verify-invite', verifyInviteCode);
router.post('/verify-invite', verifyInviteCode);
router.post('/send-otp', validate({ body: sendOtpSchema }), sendOtp);
router.post('/verify-otp', validate({ body: verifyOtpSchema }), verifyOtp);
router.post('/firebase-login', firebasePhoneLogin);
router.post('/send-email-otp', validate({ body: sendEmailOtpSchema }), sendEmailOtp);
router.post('/verify-email-otp', validate({ body: verifyEmailOtpSchema }), verifyEmailOtp);
router.post('/register', validate({ body: registerSchema }), register);
router.post('/login', validate({ body: loginSchema }), login);
router.post('/refresh', validate({ body: refreshSchema }), refresh);
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateUserProfile);
router.patch('/profile', authenticate, updateUserProfile);
router.patch('/push-token', authenticate, validate({ body: pushTokenSchema }), updatePushToken);

export default router;
