import { Router } from 'express';
import {
  handleCreatePaymentOrder,
  handleVerifyPayment,
  handleWebhook,
  handleRefund,
  createPaymentSchema,
  verifyPaymentSchema,
  refundSchema,
} from '../controllers/paymentController';
import {
  handleCreateGokwikSession,
  handleGetSessionStatus,
  handleSimulateSessionPaymentSuccess,
  handleCancelGokwikSession,
  handleRequestSessionVpaCollect,
  handleGokwikWebhook,
  createSessionSchema,
  simulateSessionSuccessSchema,
  cancelSessionSchema,
  sessionVpaCollectSchema,
} from '../controllers/gokwikController';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

// Public webhook endpoints
router.post('/webhook', handleWebhook);
router.post('/gokwik/webhook', handleGokwikWebhook);

// GoKwik UPI Session-Based Endpoints (Order placed ONLY after payment received)
router.post('/gokwik/create-session', authenticate, validate({ body: createSessionSchema }), handleCreateGokwikSession);
router.get('/gokwik/session-status/:sessionId', authenticate, handleGetSessionStatus);
router.post('/gokwik/simulate-session-success', authenticate, validate({ body: simulateSessionSuccessSchema }), handleSimulateSessionPaymentSuccess);
router.post('/gokwik/cancel-session', authenticate, validate({ body: cancelSessionSchema }), handleCancelGokwikSession);
router.post('/gokwik/session-vpa-collect', authenticate, validate({ body: sessionVpaCollectSchema }), handleRequestSessionVpaCollect);

// Customer Authenticated Endpoints (Razorpay)
router.post('/create-order', authenticate, validate({ body: createPaymentSchema }), handleCreatePaymentOrder);
router.post('/verify', authenticate, validate({ body: verifyPaymentSchema }), handleVerifyPayment);

// Admin-Only Refund Endpoint
router.post('/:orderId/refund', authenticate, requireRole('admin'), validate({ body: refundSchema }), handleRefund);

export default router;
