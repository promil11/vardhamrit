import { Router } from 'express';
import {
  addReview,
  editReview,
  removeReview,
  createReviewSchema,
  updateReviewSchema,
  reviewParamSchema,
} from '../controllers/reviewController';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import { validate } from '../middleware/validate';

const router = Router();

router.post('/', optionalAuthenticate, validate({ body: createReviewSchema }), addReview);
router.put('/:id', authenticate, validate({ params: reviewParamSchema, body: updateReviewSchema }), editReview);
router.delete('/:id', authenticate, validate({ params: reviewParamSchema }), removeReview);

export default router;
