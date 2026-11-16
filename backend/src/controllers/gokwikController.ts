import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createGokwikCheckoutSession,
  getGokwikSessionStatus,
  confirmGokwikSessionPayment,
  cancelGokwikSession,
  requestSessionVpaCollect,
  processGokwikWebhook,
} from '../services/gokwikService';
import { sendSuccess } from '../utils/response';

export const createSessionSchema = z.object({
  address: z.any().optional(),
  items: z.array(
    z.object({
      variantId: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })
  ).min(1, 'At least one item is required'),
  couponCode: z.string().optional().nullable(),
  coinsToRedeem: z.number().int().min(0).optional().default(0),
});

export const simulateSessionSuccessSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const cancelSessionSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export const sessionVpaCollectSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
  vpa: z.string().min(3, 'UPI ID is required'),
});

export async function handleCreateGokwikSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { address, items, couponCode, coinsToRedeem } = req.body;

    const session = await createGokwikCheckoutSession({
      userId,
      address,
      items,
      couponCode,
      coinsToRedeem,
    });

    return sendSuccess(res, session, 'GoKwik payment session created', 201);
  } catch (err) {
    return next(err);
  }
}

export async function handleGetSessionStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    const { sessionId } = req.params;

    const status = await getGokwikSessionStatus(sessionId, userId);
    return sendSuccess(res, status);
  } catch (err) {
    return next(err);
  }
}

export async function handleSimulateSessionPaymentSuccess(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;

    const result = await confirmGokwikSessionPayment(sessionId, {
      userId,
      paymentRef: `SIMULATED_UPI_${Date.now()}`,
      raw: { simulated: true, confirmedAt: new Date().toISOString() },
    });

    return sendSuccess(res, result, 'Payment verified and order created successfully');
  } catch (err) {
    return next(err);
  }
}

export async function handleCancelGokwikSession(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { sessionId } = req.body;

    const result = await cancelGokwikSession(sessionId, userId);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}

export async function handleRequestSessionVpaCollect(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { sessionId, vpa } = req.body;

    const result = await requestSessionVpaCollect(sessionId, vpa, userId);
    return sendSuccess(res, result, result.message);
  } catch (err) {
    return next(err);
  }
}

export async function handleGokwikWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = (req.headers['x-gokwik-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const result = await processGokwikWebhook(rawBody, signature);
    return res.status(200).json({ status: 'ok', result });
  } catch (err) {
    console.error('GoKwik Webhook Error:', err);
    return res.status(400).json({ status: 'error', message: (err as any).message });
  }
}
