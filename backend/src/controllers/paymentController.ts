import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createPaymentOrder, verifyPayment, processWebhook, processRefund } from '../services/paymentService';
import { sendSuccess, sendError } from '../utils/response';

export const createPaymentSchema = z.object({
  orderId: z.number().int().positive('Order ID is required'),
});

export const verifyPaymentSchema = z.object({
  orderId: z.number().int().positive('Order ID is required'),
  razorpayOrderId: z.string().min(1, 'Razorpay order ID is required'),
  razorpayPaymentId: z.string().min(1, 'Razorpay payment ID is required'),
  razorpaySignature: z.string().min(1, 'Razorpay signature is required'),
});

export const refundSchema = z.object({
  reason: z.string().optional().default('Cancelled or Rejected Order'),
});

export async function handleCreatePaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { orderId } = req.body;

    const paymentOrder = await createPaymentOrder(orderId, userId);
    return sendSuccess(res, paymentOrder, 'Razorpay order created');
  } catch (err) {
    return next(err);
  }
}

export async function handleVerifyPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const result = await verifyPayment(
      orderId,
      userId,
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    );

    return sendSuccess(res, result, 'Payment verified successfully');
  } catch (err) {
    return next(err);
  }
}

export async function handleWebhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const result = await processWebhook(rawBody, signature);
    return res.status(200).json({ status: 'ok', result });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(400).json({ status: 'error', message: (err as any).message });
  }
}

export async function handleRefund(req: Request, res: Response, next: NextFunction) {
  try {
    const orderId = Number(req.params.orderId);
    const { reason } = req.body;

    const result = await processRefund(orderId, reason);
    return sendSuccess(res, result);
  } catch (err) {
    return next(err);
  }
}
