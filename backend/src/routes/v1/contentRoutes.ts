import { Router } from 'express';
import {
  getBanners,
  getFlashDeal,
  getBrewingGuides,
  getTrustProps,
  getTrendingSearches,
} from '../../controllers/contentController';

const router = Router();

router.get('/banners', getBanners);
router.get('/promotions/flash-deal', getFlashDeal);
router.get('/brewing-guides', getBrewingGuides);
router.get('/trust-props', getTrustProps);
router.get('/trending-searches', getTrendingSearches);

export default router;
