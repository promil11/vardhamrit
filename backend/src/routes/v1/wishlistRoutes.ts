import { Router } from 'express';
import { getWishlist, toggleWishlist } from '../../controllers/wishlistController';
import { optionalAuthenticate } from '../../middleware/auth';

const router = Router();

router.get('/', optionalAuthenticate, getWishlist);
router.post('/:productId/toggle', optionalAuthenticate, toggleWishlist);

export default router;
