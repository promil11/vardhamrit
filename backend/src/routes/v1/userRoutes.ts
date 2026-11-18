import { Router } from 'express';
import {
  getUserProfile,
  updateUserProfile,
  getCoinHistory,
  updateUserPreferences,
  claimScratchCard,
} from '../../controllers/userController';
import { authenticate, optionalAuthenticate } from '../../middleware/auth';

const router = Router();

router.get('/profile', optionalAuthenticate, getUserProfile);
router.put('/profile', authenticate, updateUserProfile);
router.patch('/profile', authenticate, updateUserProfile);
router.get('/coins', optionalAuthenticate, getCoinHistory);
router.put('/preferences', authenticate, updateUserPreferences);
router.patch('/preferences', authenticate, updateUserPreferences);
router.post('/claim-scratch-card', optionalAuthenticate, claimScratchCard);

export default router;
