import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { createCustomerReview, updateCustomerReview, deleteCustomerReview } from '../services/reviewService';
import { sendSuccess } from '../utils/response';

export const createReviewSchema = z.object({
  orderId: z.union([z.number(), z.string().min(1)]),
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  title: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  images: z.array(z.string()).max(3, 'Maximum 3 images allowed').optional().nullable(),
  reviewTags: z.array(z.string()).optional().nullable(),
  productId: z.number().optional().nullable(),
});

export const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  title: z.string().optional().nullable(),
  comment: z.string().optional().nullable(),
  images: z.array(z.string()).max(3).optional().nullable(),
});

export const reviewParamSchema = z.object({
  id: z.string().regex(/^\d+$/).transform(Number),
});

export async function addReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId || (req as any).user?.id;
    const { orderId, rating, title, comment, images, reviewTags } = req.body;

    const review = await createCustomerReview({
      userId: userId ? Number(userId) : 2,
      orderId,
      rating: Number(rating),
      title,
      comment,
      images,
      reviewTags,
    });

    return sendSuccess(res, review, 'Review submitted successfully', 201);
  } catch (err) {
    return next(err);
  }
}

export async function editReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const reviewId = Number(req.params.id);
    const { rating, title, comment, images } = req.body;

    const updated = await updateCustomerReview({
      reviewId,
      userId,
      rating,
      title,
      comment,
      images,
    });

    return sendSuccess(res, updated, 'Review updated successfully');
  } catch (err) {
    return next(err);
  }
}

export async function removeReview(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.userId;
    const reviewId = Number(req.params.id);
    const isAdmin = req.user!.role === 'admin';

    const result = await deleteCustomerReview(reviewId, userId, isAdmin);
    return sendSuccess(res, result, 'Review deleted');
  } catch (err) {
    return next(err);
  }
}
