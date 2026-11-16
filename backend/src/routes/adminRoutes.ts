import { Router } from 'express';
import {
  getDashboardStats,
  getAdminOrders,
  approveOrder,
  rejectOrder,
  dispatchOrder,
  deliverOrder,
  markCodCollected,
  updateOrderPaymentStatus,
  exportOrdersCSV,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  getAdminReviews,
  moderateReview,
  getAdminCustomers,
  getAdminDeals,
  createAdminDeal,
  updateAdminDeal,
  toggleAdminDealStatus,
  deleteAdminDeal,
} from '../controllers/adminController';
import {
  broadcastCampaign,
  sendTestNotification,
  getCampaigns,
  getStats,
  deleteCampaign,
} from '../controllers/adminNotificationController';
import { getSingleOrder } from '../controllers/orderController';
import { downloadOrderInvoice } from '../controllers/invoiceController';
import { authenticate, requireRole } from '../middleware/auth';

const router = Router();

// Enforce authentication and admin role for all routes in /admin
router.use(authenticate, requireRole('admin'));

// Dashboard Stats
router.get('/dashboard', getDashboardStats);

// Orders & CSV Export
router.get('/orders/export/csv', exportOrdersCSV);
router.get('/orders', getAdminOrders);
router.get('/orders/:id', getSingleOrder);
router.get('/orders/:id/invoice', downloadOrderInvoice);

// Order Lifecycle Transitions
router.patch('/orders/:id/confirm', approveOrder);
router.patch('/orders/:id/approve', approveOrder);
router.patch('/orders/:id/reject', rejectOrder);
router.patch('/orders/:id/dispatch', dispatchOrder);
router.patch('/orders/:id/deliver', deliverOrder);
router.patch('/orders/:id/cod-collected', markCodCollected);
router.patch('/orders/:id/payment-status', updateOrderPaymentStatus);

// Products CRUD
router.post('/products', createAdminProduct);
router.put('/products/:id', updateAdminProduct);
router.delete('/products/:id', deleteAdminProduct);

// Coupons CRUD
router.get('/coupons', getAdminCoupons);
router.post('/coupons', createAdminCoupon);
router.put('/coupons/:id', updateAdminCoupon);

// Deal of the Day (Promotions) CRUD
router.get('/deals', getAdminDeals);
router.post('/deals', createAdminDeal);
router.put('/deals/:id', updateAdminDeal);
router.patch('/deals/:id/status', toggleAdminDealStatus);
router.delete('/deals/:id', deleteAdminDeal);

// Reviews Moderation
router.get('/reviews', getAdminReviews);
router.patch('/reviews/:id/moderate', moderateReview);

// Customers
router.get('/customers', getAdminCustomers);

// Push Notifications & Marketing Campaigns
router.get('/notifications/stats', getStats);
router.get('/notifications/campaigns', getCampaigns);
router.post('/notifications/broadcast', broadcastCampaign);
router.post('/notifications/test', sendTestNotification);
router.delete('/notifications/campaigns/:id', deleteCampaign);

export default router;
