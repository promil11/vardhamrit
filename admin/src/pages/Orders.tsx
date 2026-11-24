import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Truck,
  PackageCheck,
  FileText,
  Printer,
  DollarSign,
  X,
  Clock,
  RotateCcw,
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  Banknote,
  ChevronRight,
  ChevronLeft,
  ExternalLink,
  ShoppingBag,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ShieldCheck,
  Tag,
  ArrowUpRight,
  Send,
  Package,
  Coins,
  Wallet,
  Receipt,
  Mail,
  AlertTriangle,
  MessageCircle,
  History,
  Navigation,
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { Header } from '../components/Header';
import { getTeaImage, getFlavourColor } from '../utils/teaAssets';

const COURIER_PRESETS = [
  'BlueDart Express',
  'Delhivery Logistics',
  'DTDC Express',
  'Shadowfax',
  'Vardhamrit Express Rider',
];

const REJECT_REASONS = [
  'Out of stock / Fresh harvest batch delayed',
  'Customer requested cancellation via call/chat',
  'Delivery address unreachable / incomplete pincode',
  'Suspicious transaction / COD verification failed',
];

export const Orders: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [paymentFilter, setPaymentFilter] = useState('');

  // Selected Order for Drawer
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [drawerTab, setDrawerTab] = useState<'overview' | 'audit'>('overview');

  // Action Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [courierName, setCourierName] = useState('BlueDart Express');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Close modals or drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (rejectModalOpen) setRejectModalOpen(false);
        else if (dispatchModalOpen) setDispatchModalOpen(false);
        else if (selectedOrderId) setSelectedOrderId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrderId, rejectModalOpen, dispatchModalOpen]);

  // Fetch orders
  const { data: ordersData, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-orders', page, search, statusFilter, paymentFilter],
    queryFn: async () => {
      const res = await api.get('/admin/orders', {
        params: {
          page,
          limit: 15,
          search: search || undefined,
          status: statusFilter || undefined,
          paymentStatus: paymentFilter || undefined,
        },
      });
      return res.data?.data;
    },
    refetchInterval: 15000,
  });

  // Fetch single order detail when drawer is open
  const { data: singleOrder, isLoading: isSingleLoading } = useQuery({
    queryKey: ['admin-single-order', selectedOrderId],
    queryFn: async () => {
      const res = await api.get(`/admin/orders/${selectedOrderId}`);
      return res.data?.data;
    },
    enabled: !!selectedOrderId,
  });

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  // Action Mutations
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/orders/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      setFeedback({
        type: 'success',
        title: 'Order Confirmed & Invoiced',
        message: 'Order has been confirmed and the GST tax invoice was generated automatically.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Approval Failed',
        message: err.response?.data?.error || err.message || 'Failed to approve order.',
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) return;
      await api.patch(`/admin/orders/${selectedOrderId}/reject`, { reason: rejectReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      setRejectModalOpen(false);
      setRejectReason('');
      setFeedback({
        type: 'success',
        title: 'Order Rejected & Cancelled',
        message: 'Order has been cancelled, inventory stock restocked, and customer notified.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Rejection Failed',
        message: err.response?.data?.error || err.message || 'Failed to reject order.',
      });
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrderId) return;
      await api.patch(`/admin/orders/${selectedOrderId}/dispatch`, { courierName, trackingNumber });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      setDispatchModalOpen(false);
      setTrackingNumber('');
      setFeedback({
        type: 'success',
        title: 'Order Dispatched',
        message: `Dispatched with ${courierName}. Tracking #${trackingNumber} assigned.`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Dispatch Failed',
        message: err.response?.data?.error || err.message || 'Failed to dispatch order.',
      });
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/orders/${id}/deliver`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      setFeedback({
        type: 'success',
        title: 'Order Delivered',
        message: 'Package marked as delivered to customer. Order lifecycle completed.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Delivery Update Failed',
        message: err.response?.data?.error || err.message || 'Failed to mark as delivered.',
      });
    },
  });

  const codCollectedMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.patch(`/admin/orders/${id}/cod-collected`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      setFeedback({
        type: 'success',
        title: 'Payment Collected',
        message: 'Cash on delivery payment has been verified and marked as PAID.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Payment Update Failed',
        message: err.response?.data?.error || err.message || 'Failed to update payment status.',
      });
    },
  });

  const exportCSV = async () => {
    try {
      const res = await api.get('/admin/orders/export/csv', {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vardhamrit-orders-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const token = localStorage.getItem('vardhamrit_admin_token');
      window.open(`${API_BASE_URL}/admin/orders/export/csv?token=${token}`, '_blank');
    }
  };

  const downloadInvoice = async (orderId: number) => {
    try {
      const res = await api.get(`/admin/orders/${orderId}/invoice`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-order-${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const token = localStorage.getItem('vardhamrit_admin_token');
      window.open(`${API_BASE_URL}/admin/orders/${orderId}/invoice?token=${token}`, '_blank');
    }
  };

  const printPackingSlip = (order: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Packing Slip - Order #${order.id}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #1e293b; line-height: 1.5; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0A3521; padding-bottom: 16px; margin-bottom: 20px; }
            h2 { margin: 0; color: #0A3521; font-size: 20px; text-transform: uppercase; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; }
            th { background: #f8fafc; font-weight: 800; color: #0f172a; }
            .address-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>VARDHAMRIT TEA ESTATE</h2>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">Official Warehouse Dispatch Slip • 100% Garden-Fresh Assam Tea</p>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-weight: 900; font-size: 16px; color: #0f172a;">Order #${order.order_number || order.id}</p>
              <p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">${new Date(order.created_at).toLocaleDateString('en-IN')}</p>
            </div>
          </div>

          <div class="address-box">
            <strong style="color: #0A3521; font-size: 11px; text-transform: uppercase;">Ship To Customer:</strong><br/>
            <strong style="font-size: 14px; color: #0f172a;">${order.address_snapshot?.name || order.customer_name}</strong><br/>
            ${order.address_snapshot?.line1 || ''}${order.address_snapshot?.line2 ? `, ${order.address_snapshot.line2}` : ''}<br/>
            ${order.address_snapshot?.city || ''}, ${order.address_snapshot?.state || ''} - <strong>${order.address_snapshot?.pincode || ''}</strong><br/>
            <strong>Phone:</strong> ${order.address_snapshot?.phone || order.customer_phone}
            ${order.address_snapshot?.landmark ? `<br/><strong>Landmark:</strong> ${order.address_snapshot.landmark}` : ''}
            ${order.address_snapshot?.latitude && order.address_snapshot?.longitude ? `
            <div style="margin-top: 8px; padding: 6px 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; font-size: 11px; color: #065f46;">
              📍 <strong>Exact Delivery Pin:</strong> ${order.address_snapshot.latitude}, ${order.address_snapshot.longitude} 
              — <a href="https://www.google.com/maps/search/?api=1&query=${order.address_snapshot.latitude},${order.address_snapshot.longitude}" target="_blank" style="color: #047857; text-decoration: underline; font-weight: bold;">Open in Google Maps</a>
            </div>` : ''}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50%;">Chai Blend</th>
                <th style="width: 30%;">Pack Size</th>
                <th style="width: 20%; text-align: center;">Quantity</th>
              </tr>
            </thead>
            <tbody>
              ${(order.items || [])
        .map(
          (it: any) => `
                <tr>
                  <td><strong>${it.product_name}</strong></td>
                  <td>${it.variant_label}</td>
                  <td style="text-align: center; font-weight: bold;">${it.quantity}</td>
                </tr>`
        )
        .join('')}
            </tbody>
          </table>

          <div style="margin-top: 24px; padding: 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 12px; line-height: 1.8;">
            <div style="display: flex; justify-content: space-between;"><span>Items Gross Subtotal:</span> <span>₹${Number(order.subtotal || order.total).toFixed(2)}</span></div>
            ${Number(order.discount_amount || 0) > 0 ? `<div style="display: flex; justify-content: space-between; color: #047857;"><span>Coupon Discount:</span> <span>-₹${Number(order.discount_amount).toFixed(2)}</span></div>` : ''}
            ${Number(order.coins_discount || order.coins_redeemed || 0) > 0 ? `<div style="display: flex; justify-content: space-between; color: #b45309;"><span>Wallet Coins (${order.coins_redeemed || 0} Coins):</span> <span>-₹${Number(order.coins_discount || order.coins_redeemed).toFixed(2)}</span></div>` : ''}
            <div style="display: flex; justify-content: space-between; color: #475569;"><span>GST (CGST 2.5% + SGST 2.5%):</span> <span>₹${Number(order.tax_amount || 0).toFixed(2)}</span></div>
            <div style="display: flex; justify-content: space-between;"><span>Express Delivery:</span> <span>${Number(order.delivery_fee || 0) === 0 ? 'FREE' : '₹' + Number(order.delivery_fee).toFixed(2)}</span></div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 2px dashed #cbd5e1; display: flex; justify-content: space-between; font-weight: 900; font-size: 14px; color: #0f172a;">
              <span>Net Payable (${order.payment_method} - ${order.payment_status}):</span>
              <span>₹${Number(order.total || order.total_amount).toFixed(2)}</span>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PLACED':
        return {
          bg: 'bg-amber-50/90 text-amber-800 border-amber-200/90',
          dot: 'bg-amber-500 animate-pulse',
          label: 'Awaiting Confirmation',
          tag: 'Needs Confirmation',
        };
      case 'CONFIRMED':
        return {
          bg: 'bg-sky-50 text-sky-800 border-sky-200/90',
          dot: 'bg-sky-500',
          label: 'Confirmed',
          tag: 'Ready for Dispatch',
        };
      case 'PACKED':
      case 'APPROVED':
        return {
          bg: 'bg-indigo-50 text-indigo-800 border-indigo-200/90',
          dot: 'bg-indigo-500',
          label: 'Packed',
          tag: 'Ready for Dispatch',
        };
      case 'DISPATCHED':
        return {
          bg: 'bg-purple-50 text-purple-800 border-purple-200/90',
          dot: 'bg-purple-500 animate-pulse',
          label: 'In Transit',
          tag: 'With Courier',
        };
      case 'DELIVERED':
        return {
          bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/90',
          dot: 'bg-emerald-600',
          label: 'Delivered',
          tag: 'Completed',
        };
      case 'CANCELLED':
      case 'REJECTED':
        return {
          bg: 'bg-rose-50 text-rose-800 border-rose-200/90',
          dot: 'bg-rose-500',
          label: 'Cancelled',
          tag: 'Cancelled',
        };
      default:
        return {
          bg: 'bg-slate-50 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          label: status,
          tag: 'Active',
        };
    }
  };

  const getStepIndex = (status: string) => {
    if (status === 'PLACED' || status === 'CONFIRMED') return 0;
    if (status === 'PACKED' || status === 'APPROVED') return 1;
    if (status === 'DISPATCHED') return 2;
    if (status === 'DELIVERED') return 3;
    return -1;
  };

  const orders = ordersData?.items || [];
  const pagination = ordersData?.pagination || { page: 1, totalPages: 1, totalItems: 0 };

  // KPI Calculations
  const totalVolume = pagination.totalItems || orders.length;
  const pendingOrders = orders.filter((o: any) => ['PLACED', 'CONFIRMED'].includes(o.status)).length;
  const inTransitOrders = orders.filter((o: any) => o.status === 'DISPATCHED').length;
  const deliveredOrders = orders.filter((o: any) => o.status === 'DELIVERED').length;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Order Operations & Fulfillment"
        subtitle="Live order processing, picking & packing, courier assignment, and GST invoicing"
        onRefresh={() => refetch()}
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => refetch()}
              className="p-2 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/90 rounded-xl transition-all shadow-xs active:scale-95"
              title="Refresh live orders"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-emerald-800' : ''}`} />
            </button>
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black transition-all shadow-sm active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        }
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Orders */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between hover:shadow-card-elevated transition-shadow">
            <div>
              <p className="text-[11px] font-black uppercase text-slate-400 tracking-wider">Total Volume</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalVolume}</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Recorded orders</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-emerald-700" />
            </div>
          </div>

          {/* 2. Requires Packing */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between hover:shadow-card-elevated transition-shadow">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                <p className="text-[11px] font-black uppercase text-amber-700 tracking-wider">Requires Packing</p>
              </div>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{pendingOrders}</h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-0.5">Needs warehouse action</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200/80 flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-700" />
            </div>
          </div>

          {/* 3. In Transit */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between hover:shadow-card-elevated transition-shadow">
            <div>
              <p className="text-[11px] font-black uppercase text-purple-700 tracking-wider">In Transit</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{inTransitOrders}</h3>
              <p className="text-[11px] text-purple-700 font-semibold mt-0.5">Dispatched via courier</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200/80 flex items-center justify-center">
              <Truck className="w-6 h-6 text-purple-700" />
            </div>
          </div>

          {/* 4. Delivered */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between hover:shadow-card-elevated transition-shadow">
            <div>
              <p className="text-[11px] font-black uppercase text-emerald-800 tracking-wider">Delivered</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{deliveredOrders}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-0.5">Fulfilled successfully</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200/80 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-100/80 rounded-2xl border border-slate-200/80">
          {[
            { id: '', label: 'All Orders', count: totalVolume },
            { id: 'PLACED', label: 'To Confirm (New)', count: orders.filter((o: any) => o.status === 'PLACED').length, alert: orders.filter((o: any) => o.status === 'PLACED').length > 0 },
            { id: 'CONFIRMED', label: 'Confirmed (To Dispatch)', count: orders.filter((o: any) => o.status === 'CONFIRMED').length },
            { id: 'PACKED', label: 'Packed & Invoiced' },
            { id: 'DISPATCHED', label: 'In Transit', count: inTransitOrders },
            { id: 'DELIVERED', label: 'Delivered', count: deliveredOrders },
            { id: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black transition-all ${isActive
                  ? 'bg-emerald-950 text-amber-300 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200/60'
                  }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${isActive
                      ? 'bg-emerald-800 text-white'
                      : tab.alert
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                      }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-card-subtle flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by Order #, Customer Name, Phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:bg-white focus:outline-none transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
              <CreditCard className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={paymentFilter}
                onChange={(e) => {
                  setPaymentFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="">All Payments</option>
                <option value="PAID">Paid (Razorpay / Settled)</option>
                <option value="PENDING">Pending (COD Uncollected)</option>
                <option value="FAILED">Payment Failed</option>
              </select>
            </div>

            <span className="text-xs text-slate-500 font-bold whitespace-nowrap bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200/60">
              {pagination.totalItems || orders.length} results
            </span>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading order records from MySQL...</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-3">
              <PackageCheck className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="text-sm font-bold text-slate-700">No Orders Found</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No orders match your current filter parameters. Try clearing your search keyword or switching status tabs.
              </p>
              {(search || statusFilter || paymentFilter) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('');
                    setPaymentFilter('');
                  }}
                  className="text-xs font-bold text-emerald-800 hover:underline"
                >
                  Clear all active filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 text-slate-500 border-b border-slate-200/80 font-bold uppercase tracking-wider text-[11px] select-none">
                    <th className="py-3.5 pl-6 pr-4 min-w-[150px]">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-slate-400" />
                        <span>Order #</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[210px]">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3 h-3 text-slate-400" />
                        <span>Customer</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[140px]">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Date & Time</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[160px]">
                      <div className="flex items-center gap-1.5">
                        <Package className="w-3 h-3 text-slate-400" />
                        <span>Fulfillment</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[190px]">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3 text-slate-400" />
                        <span>Payment</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 min-w-[130px]">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="w-3 h-3 text-slate-400" />
                        <span>Total Amount</span>
                      </div>
                    </th>
                    <th className="py-3.5 pl-4 pr-6 text-right min-w-[170px]">
                      <span>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {orders.map((o: any) => {
                    const statusObj = getStatusBadge(o.status);
                    const formattedOrderNum = o.order_number || `VRD-${o.id}`;

                    return (
                      <tr
                        key={o.id}
                        onClick={() => setSelectedOrderId(o.id)}
                        className="group hover:bg-emerald-50/30 transition-all duration-150 cursor-pointer relative"
                      >
                        {/* Order Reference */}
                        <td className="py-4 pl-6 pr-4 align-middle relative" onClick={(e) => e.stopPropagation()}>
                          <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#0A3622] rounded-r-md opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[12px] font-bold text-slate-900 bg-slate-100/90 group-hover:bg-emerald-100/80 group-hover:text-emerald-950 border border-slate-200/80 group-hover:border-emerald-300 px-2.5 py-1 rounded-lg transition-all tracking-tight whitespace-nowrap shadow-2xs">
                              #{formattedOrderNum}
                            </span>
                            <button
                              onClick={() => handleCopy(formattedOrderNum, `order-${o.id}`)}
                              className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-all active:scale-90"
                              title="Copy order number"
                            >
                              {copiedItem === `order-${o.id}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                              )}
                            </button>
                          </div>
                          {o.courier_name && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50/90 border border-purple-200/70 rounded-md px-2 py-0.5 shadow-2xs">
                                <Truck className="w-3 h-3 text-purple-600" />
                                <span>{o.courier_name}</span>
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Customer */}
                        <td className="py-4 px-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="relative flex-shrink-0">
                              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-800 to-[#0A3622] text-amber-300 font-black text-xs flex items-center justify-center shadow-sm ring-2 ring-emerald-100/80">
                                {o.customer_name ? o.customer_name.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold text-slate-900 text-[13px] leading-tight group-hover:text-emerald-950 transition-colors truncate max-w-[190px]">
                                {o.customer_name || 'Guest User'}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                <span className="truncate">{o.customer_phone || o.address_snapshot?.phone || 'No phone'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {o.address_snapshot?.city && (
                                  <span className="text-[10.5px] text-slate-500 font-medium flex items-center gap-1">
                                    <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                    <span>{o.address_snapshot.city}, {o.address_snapshot.state}</span>
                                  </span>
                                )}
                                {o.address_snapshot?.latitude && o.address_snapshot?.longitude && (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${o.address_snapshot.latitude},${o.address_snapshot.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Open exact GPS pin in Google Maps"
                                    className="inline-flex items-center gap-1 text-[9.5px] text-emerald-800 hover:text-emerald-950 font-bold bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/90 rounded-md px-1.5 py-0.5 transition-colors shadow-2xs"
                                  >
                                    <Navigation className="w-2.5 h-2.5 text-emerald-600" />
                                    <span>GPS</span>
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Placement Date */}
                        <td className="py-4 px-4 align-middle">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-slate-800">
                              <Calendar className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span>
                                {new Date(o.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 pl-4.5">
                              <Clock className="w-2.5 h-2.5 text-slate-300" />
                              <span>
                                {new Date(o.created_at).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Fulfillment Status */}
                        <td className="py-4 px-4 align-middle">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all shadow-2xs whitespace-nowrap ${statusObj.bg}`}
                          >
                            <span className="relative flex h-2 w-2">
                              {o.status === 'PLACED' && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                              )}
                              {o.status === 'DISPATCHED' && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                              )}
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusObj.dot.replace('animate-pulse', '')}`} />
                            </span>
                            <span>{statusObj.label}</span>
                          </span>
                        </td>

                        {/* Payment */}
                        <td className="py-4 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-col gap-1.5 min-w-[175px]">
                            {/* Branded Method Line */}
                            <div className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 border shadow-2xs ${o.payment_method === 'COD'
                                ? 'bg-amber-50 text-amber-700 border-amber-200/90'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200/90'
                                }`}>
                                {o.payment_method === 'COD' ? (
                                  <Banknote className="w-3.5 h-3.5" />
                                ) : (
                                  <CreditCard className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <span className="text-[12px] font-bold text-slate-800 tracking-tight whitespace-nowrap">
                                {o.payment_method === 'COD' ? 'Cash on Delivery' : 'Online (Prepaid)'}
                              </span>
                            </div>

                            {/* Status Badge + Mark Paid Action */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold border whitespace-nowrap shadow-2xs ${o.payment_status === 'PAID'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200/90'
                                  : 'bg-amber-50 text-amber-900 border-amber-200/90'
                                  }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${o.payment_status === 'PAID' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                <span>{o.payment_status === 'PAID' ? 'Paid / Settled' : 'Unpaid (COD)'}</span>
                              </span>

                              {o.payment_method === 'COD' && o.payment_status !== 'PAID' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    codCollectedMutation.mutate(o.id);
                                  }}
                                  disabled={codCollectedMutation.isPending}
                                  className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white text-[10.5px] font-bold shadow-2xs hover:shadow-xs transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                                  title="Mark Cash on Delivery as Collected/Paid"
                                >
                                  <Check className="w-2.5 h-2.5" />
                                  <span>Mark Paid</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Gross Total */}
                        <td className="py-4 px-4 align-middle">
                          <div className="space-y-0.5">
                            <div className="text-base font-black text-slate-900 tracking-tight font-sans">
                              ₹{Number(o.total || o.total_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            {Number(o.delivery_fee || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200/60">
                                <span>+₹{o.delivery_fee} delivery</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                                <span>Free Delivery</span>
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-4 pl-4 pr-6 text-right align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => downloadInvoice(o.id)}
                              className="p-2 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-xl transition-all border border-slate-200/80 hover:border-emerald-200 shadow-2xs hover:shadow-xs active:scale-95"
                              title="Download Official GST Invoice (PDF)"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setSelectedOrderId(o.id)}
                              className="bg-[#0A3622] hover:bg-[#124b31] text-amber-300 hover:text-white px-3.5 py-2 rounded-xl text-xs font-black inline-flex items-center gap-1.5 transition-all active:scale-95 shadow-sm hover:shadow-md whitespace-nowrap"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-300" />
                              <span>Fulfill & Manage</span>
                              <ChevronRight className="w-3.5 h-3.5 opacity-70 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-slate-200/70 bg-gradient-to-b from-slate-50/40 to-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">
                Page <span className="font-extrabold text-slate-900">{pagination.page}</span> of{' '}
                <span className="font-extrabold text-slate-900">{pagination.totalPages || 1}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-slate-500 font-semibold">
                Showing {orders.length} of {pagination.totalItems || orders.length} orders
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 text-xs active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl font-bold border border-slate-200/80 shadow-2xs hover:shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all inline-flex items-center gap-1.5 text-xs active:scale-95"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ================================================================ */}
      {/* ORDER DETAILS & ACTIONS DRAWER (SLIDE-OVER) */}
      {/* ================================================================ */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
          onClick={() => setSelectedOrderId(null)}
        >
          <div
            className="w-full max-w-2xl lg:max-w-3xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {isSingleLoading || !singleOrder ? (
              <div className="p-16 flex flex-col items-center justify-center flex-1 space-y-3">
                <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                <p className="text-xs font-bold text-slate-500">Loading order #{selectedOrderId} details...</p>
              </div>
            ) : (
              <>
                {/* Luxury Estate Drawer Header - Pinned at Top, Never Scrolls Away */}
                <div className="px-6 py-5 bg-gradient-to-r from-[#03140C] via-[#0A3521] to-[#04190F] text-white border-b border-emerald-800/50 relative overflow-hidden shadow-xl shrink-0 z-20">
                  <div className="absolute top-0 right-0 w-96 h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/15 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute -left-10 -bottom-10 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Top Status & Payment Badges */}
                      <div className="flex flex-wrap items-center gap-2 mb-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-300 bg-white/10 backdrop-blur-md px-2.5 py-1 rounded-lg border border-emerald-400/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Order Fulfillment
                        </span>

                        <span
                          className={`inline-flex items-center gap-1.5 text-[10.5px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-xs ${singleOrder.payment_method === 'COD'
                            ? 'bg-amber-400 text-slate-950 font-bold border border-amber-300'
                            : 'bg-emerald-400 text-slate-950 font-bold border border-emerald-300'
                            }`}
                        >
                          {singleOrder.payment_method === 'COD' ? '💵 Cash on Delivery' : '💳 Prepaid Online'}
                        </span>

                        {singleOrder.payment_status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                            <Check className="w-3 h-3 stroke-[3]" />
                            Payment Settled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider bg-amber-500/20 text-amber-200 border border-amber-400/40">
                            Payment Pending
                          </span>
                        )}
                      </div>

                      {/* Order Number & Quick Copy */}
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-mono drop-shadow-sm">
                          #{singleOrder.order_number || singleOrder.id}
                        </h3>
                        <button
                          onClick={() => handleCopy(singleOrder.order_number || String(singleOrder.id), 'drawer-order-id')}
                          className="px-2.5 py-1 bg-white/10 hover:bg-white/20 active:scale-95 rounded-lg text-slate-200 hover:text-white transition-all flex items-center gap-1 text-[11px] font-bold border border-white/15"
                          title="Copy order number"
                        >
                          {copiedItem === 'drawer-order-id' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span className="text-emerald-300">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy ID</span>
                            </>
                          )}
                        </button>
                      </div>

                      <p className="text-xs text-emerald-200/80 mt-1.5 flex items-center gap-1.5 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>
                          Placed on{' '}
                          {new Date(singleOrder.created_at).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </p>
                    </div>

                    {/* Integrated Sleek Close Cross Button */}
                    <button
                      type="button"
                      onClick={() => setSelectedOrderId(null)}
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-rose-600 text-white/80 hover:text-white transition-all duration-200 flex items-center justify-center shrink-0 border border-white/20 hover:border-rose-500 shadow-md active:scale-95 cursor-pointer group"
                      title="Close drawer (Esc)"
                      aria-label="Close drawer"
                    >
                      <X className="w-5 h-5 stroke-[2.2] group-hover:rotate-90 transition-transform duration-200" />
                    </button>
                  </div>

                  {/* Sub-Navigation Modern Pill Tabs */}
                  <div className="flex items-center gap-1.5 mt-4 pt-3.5 border-t border-emerald-800/60 relative z-10">
                    <button
                      type="button"
                      onClick={() => setDrawerTab('overview')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${drawerTab === 'overview'
                        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                        : 'text-emerald-200/90 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Fulfillment & Dispatch</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDrawerTab('audit')}
                      className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${drawerTab === 'audit'
                        ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold'
                        : 'text-emerald-200/90 hover:text-white hover:bg-white/10'
                        }`}
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>Audit Trail & Event Log</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${drawerTab === 'audit'
                          ? 'bg-black/20 text-slate-950'
                          : 'bg-white/15 text-emerald-200'
                          }`}
                      >
                        {(singleOrder.status_history || []).length}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Scrollable Drawer Body */}
                <div className="flex-1 overflow-y-auto">
                  {drawerTab === 'overview' ? (
                    <>
                      {/* 4-Step Connected Fulfillment Stepper */}
                      <div className="px-6 py-5 bg-gradient-to-b from-slate-50 via-white to-slate-50/50 border-b border-slate-200/80">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-600" />
                            <p className="text-[11px] font-black uppercase text-slate-500 tracking-wider">
                              Live Parcel Journey
                            </p>
                          </div>
                          <span className="text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            Step {Math.max(1, getStepIndex(singleOrder.status) + 1)} of 4
                          </span>
                        </div>

                        <div className="relative px-3 pt-2 pb-1">
                          {/* Connecting Background Progress Bar Line */}
                          <div className="absolute top-7 left-10 right-10 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-700 via-emerald-600 to-teal-500 rounded-full transition-all duration-500 shadow-xs"
                              style={{
                                width: `${(Math.max(0, getStepIndex(singleOrder.status)) / 3) * 100}%`,
                              }}
                            />
                          </div>

                          {/* Step Nodes */}
                          <div className="relative z-10 flex justify-between">
                            {[
                              { label: 'Confirmed', icon: ShoppingBag, step: 0 },
                              { label: 'Packed & Invoiced', icon: PackageCheck, step: 1 },
                              { label: 'In Transit', icon: Truck, step: 2 },
                              { label: 'Delivered', icon: ShieldCheck, step: 3 },
                            ].map((st) => {
                              const currentIdx = getStepIndex(singleOrder.status);
                              const isComplete = currentIdx > st.step;
                              const isCurrent = currentIdx === st.step;
                              const Icon = st.icon;

                              return (
                                <div key={st.step} className="flex flex-col items-center text-center max-w-[95px]">
                                  <div
                                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-200 ${isComplete
                                      ? 'bg-emerald-700 text-white shadow-md ring-4 ring-emerald-50'
                                      : isCurrent
                                        ? 'bg-gradient-to-br from-emerald-950 to-[#0A3521] text-amber-300 shadow-lg ring-4 ring-emerald-200 scale-110'
                                        : 'bg-white text-slate-300 border-2 border-slate-200 shadow-2xs'
                                      }`}
                                  >
                                    {isComplete ? (
                                      <Check className="w-5 h-5 stroke-[3]" />
                                    ) : (
                                      <Icon className={`w-5 h-5 ${isCurrent ? 'stroke-[2.5]' : 'stroke-[1.8]'}`} />
                                    )}
                                  </div>
                                  <span
                                    className={`text-[11px] font-black mt-2.5 leading-tight ${isCurrent
                                      ? 'text-emerald-950 font-black'
                                      : isComplete
                                        ? 'text-slate-800 font-bold'
                                        : 'text-slate-400 font-medium'
                                      }`}
                                  >
                                    {st.label}
                                  </span>
                                  <span
                                    className={`text-[9.5px] mt-0.5 font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isCurrent
                                      ? 'text-emerald-800 bg-emerald-50'
                                      : isComplete
                                        ? 'text-slate-500'
                                        : 'text-slate-400'
                                      }`}
                                  >
                                    {isComplete ? 'Done' : isCurrent ? 'Current' : 'Upcoming'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* Drawer Content Body */}
                      <div className="p-6 space-y-6 flex-1 text-xs bg-slate-50/50">
                        {/* Rejection / Cancellation Alert Banner if applicable */}
                        {singleOrder.rejection_reason && (
                          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 shadow-2xs">
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <h5 className="text-xs font-black text-rose-900">Order Rejection / Cancellation Reason</h5>
                              <p className="text-xs text-rose-700 mt-0.5 font-medium leading-relaxed">
                                {singleOrder.rejection_reason}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Logistics & Tracking Card if dispatched */}
                        {(singleOrder.courier_name || singleOrder.tracking_number) && (
                          <div className="bg-gradient-to-br from-purple-50/80 via-white to-indigo-50/50 p-9.5 rounded-3xl border border-purple-200/90 shadow-card-subtle space-y-3">
                            <div className="flex items-center justify-between p-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-xs">
                                  <Truck className="w-5 h-5" />
                                </div>
                                <div>
                                  <span className="text-[10px] font-black uppercase text-purple-700 tracking-wider block">
                                    Assigned Courier Logistics
                                  </span>
                                  <h5 className="text-xs font-black text-slate-900">
                                    {singleOrder.courier_name || 'Blue Dart Express'}
                                  </h5>
                                </div>
                              </div>
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-purple-100 text-purple-800 border border-purple-300">
                                Active AWB
                              </span>
                            </div>

                            {singleOrder.tracking_number && (
                              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white rounded-2xl border border-purple-100 shadow-2xs">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                                    Consignment / Tracking Number
                                  </span>
                                  <p className="font-mono font-black text-slate-900 text-sm tracking-wide">
                                    {singleOrder.tracking_number}
                                  </p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleCopy(singleOrder.tracking_number, 'awb-tracking')}
                                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-purple-200 active:scale-95"
                                  >
                                    {copiedItem === 'awb-tracking' ? (
                                      <>
                                        <Check className="w-3.5 h-3.5 text-purple-700" />
                                        <span>Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="w-3.5 h-3.5" />
                                        <span>Copy AWB</span>
                                      </>
                                    )}
                                  </button>
                                  <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(
                                      `track parcel ${singleOrder.courier_name || ''} ${singleOrder.tracking_number}`
                                    )}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    <span>Track Courier</span>
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Fulfillment Command Card */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block">
                                Current Operational Stage
                              </span>
                              <h4 className="text-sm font-black text-slate-900 mt-0.5">
                                {singleOrder.status === 'PLACED'
                                  ? 'Order Placed — Waiting for Admin Confirmation'
                                  : singleOrder.status === 'CONFIRMED'
                                    ? 'Order Confirmed — Ready for Packing & Dispatch'
                                    : singleOrder.status === 'PACKED' || singleOrder.status === 'APPROVED'
                                      ? 'Packed & Invoiced — Ready for Courier Handover'
                                      : singleOrder.status === 'DISPATCHED'
                                        ? 'In Transit with Logistics Partner'
                                        : singleOrder.status === 'DELIVERED'
                                          ? 'Package Delivered Successfully'
                                          : 'Order Cancelled'}
                              </h4>
                            </div>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-black border ${getStatusBadge(singleOrder.status).bg
                                }`}
                            >
                              {singleOrder.status}
                            </span>
                          </div>

                          {/* Primary Lifecycle Action Buttons */}
                          <div className="space-y-2.5 pt-1">
                            {singleOrder.status === 'PLACED' && (
                              <div className="flex gap-2.5">
                                <button
                                  onClick={() => approveMutation.mutate(singleOrder.id)}
                                  disabled={approveMutation.isPending}
                                  className="flex-1 bg-gradient-to-r from-emerald-700 via-emerald-800 to-emerald-900 hover:from-emerald-600 hover:to-emerald-700 text-white py-3.5 px-5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                                >
                                  <CheckCircle className="w-4 h-4 text-amber-300" />
                                  <span>
                                    {approveMutation.isPending ? 'Confirming Order...' : 'Confirm Order & Issue GST Invoice'}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-emerald-200" />
                                </button>
                                <button
                                  onClick={() => setRejectModalOpen(true)}
                                  className="px-4 py-3.5 bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-200 rounded-2xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                  title="Reject / Cancel"
                                >
                                  <XCircle className="w-4 h-4" />
                                  <span>Reject</span>
                                </button>
                              </div>
                            )}

                            {['CONFIRMED', 'APPROVED', 'PACKED'].includes(singleOrder.status) && (
                              <button
                                onClick={() => setDispatchModalOpen(true)}
                                className="w-full bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white py-3.5 px-5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                              >
                                <Truck className="w-4 h-4 text-purple-200" />
                                <span>Dispatch with BlueDart / Logistics Partner</span>
                                <ChevronRight className="w-4 h-4 text-purple-200" />
                              </button>
                            )}

                            {['DISPATCHED'].includes(singleOrder.status) && (
                              <button
                                onClick={() => deliverMutation.mutate(singleOrder.id)}
                                disabled={deliverMutation.isPending}
                                className="w-full bg-gradient-to-r from-emerald-800 to-teal-800 hover:from-emerald-700 hover:to-teal-700 text-white py-3.5 px-5 rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer"
                              >
                                <PackageCheck className="w-4 h-4 text-amber-300" />
                                <span>{deliverMutation.isPending ? 'Marking Delivered...' : 'Mark as Successfully Delivered'}</span>
                              </button>
                            )}
                          </div>

                          {/* Dedicated COD Cash Payment Clearance Box */}
                          {singleOrder.payment_method === 'COD' && (
                            <div
                              className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${singleOrder.payment_status === 'PAID'
                                ? 'bg-emerald-50/80 border-emerald-200/90'
                                : 'bg-amber-50/80 border-amber-200/90'
                                }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${singleOrder.payment_status === 'PAID'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-amber-500 text-slate-950 font-bold'
                                    }`}
                                >
                                  <DollarSign className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 text-xs">
                                    {singleOrder.payment_status === 'PAID'
                                      ? 'COD Cash Settled & Received'
                                      : 'Cash on Delivery (COD) Pending'}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-medium">
                                    Amount: <strong className="text-slate-800">₹{Number(singleOrder.total || singleOrder.total_amount).toFixed(2)}</strong>
                                  </p>
                                </div>
                              </div>

                              {singleOrder.payment_status !== 'PAID' && (
                                <button
                                  onClick={() => codCollectedMutation.mutate(singleOrder.id)}
                                  disabled={codCollectedMutation.isPending}
                                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs shadow-xs hover:shadow-sm active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                  <span>{codCollectedMutation.isPending ? 'Updating...' : 'Mark as PAID'}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {/* Quick Document Actions */}
                          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => downloadInvoice(singleOrder.id)}
                              className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all active:scale-98 cursor-pointer"
                            >
                              <FileText className="w-4 h-4 text-emerald-800" />
                              <span>GST Tax Invoice (PDF)</span>
                            </button>
                            <button
                              onClick={() => printPackingSlip(singleOrder)}
                              className="p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center justify-center gap-2 shadow-2xs hover:shadow-xs transition-all active:scale-98 cursor-pointer"
                            >
                              <Printer className="w-4 h-4 text-amber-700" />
                              <span>Print Packing Slip</span>
                            </button>
                          </div>
                        </div>

                        {/* Shipping Delivery Destination Dossier Card */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-3.5">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <MapPin className="w-4 h-4 text-emerald-800" />
                              <span>Shipping Delivery Destination</span>
                            </h4>
                            {singleOrder.address_snapshot && (
                              <button
                                onClick={() => {
                                  const a = singleOrder.address_snapshot;
                                  const fullAddr = `${a.name || singleOrder.customer_name}, ${a.line1}${a.line2 ? `, ${a.line2}` : ''
                                    }, ${a.city}, ${a.state} - ${a.pincode}, Phone: ${a.phone || singleOrder.customer_phone
                                    }`;
                                  handleCopy(fullAddr, 'address');
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                              >
                                {copiedItem === 'address' ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                                    <span className="text-emerald-800">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Copy Full Label</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>

                          <div className="bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-200/80 space-y-3">
                            {/* Customer Identity Row */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-800 to-emerald-950 text-amber-300 font-black text-xs flex items-center justify-center shadow-xs">
                                  {(singleOrder.address_snapshot?.name || singleOrder.customer_name || 'C')
                                    .charAt(0)
                                    .toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-black text-slate-900 text-sm leading-tight">
                                    {singleOrder.address_snapshot?.name || singleOrder.customer_name || 'Customer'}
                                  </p>
                                  {singleOrder.address_snapshot?.tag && (
                                    <span className="inline-block mt-0.5 px-2 py-0.2 rounded text-[9.5px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      {singleOrder.address_snapshot.tag}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-black font-mono text-emerald-950 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                                PIN: {singleOrder.address_snapshot?.pincode}
                              </span>
                            </div>

                            {/* Exact Doorstep / Building Address */}
                            <div className="bg-white/80 p-3 rounded-xl border border-slate-200/60 space-y-1">
                              <p className="text-xs text-slate-800 font-bold leading-relaxed">
                                {singleOrder.address_snapshot?.line1}
                                {singleOrder.address_snapshot?.line2 && `, ${singleOrder.address_snapshot.line2}`}
                              </p>
                              <p className="text-xs text-slate-600 font-medium">
                                {singleOrder.address_snapshot?.city}, {singleOrder.address_snapshot?.state}
                              </p>
                              {singleOrder.address_snapshot?.landmark && (
                                <p className="text-xs text-amber-900 bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/60 font-medium inline-block mt-1">
                                  <span className="font-bold">Landmark:</span> {singleOrder.address_snapshot.landmark}
                                </p>
                              )}
                            </div>

                            {/* Exact GPS Pin & Google Maps Navigation Button */}
                            {singleOrder.address_snapshot?.latitude && singleOrder.address_snapshot?.longitude && (
                              <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                  <span>
                                    {Number(singleOrder.address_snapshot.latitude).toFixed(6)}, {Number(singleOrder.address_snapshot.longitude).toFixed(6)}
                                  </span>
                                </div>
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${singleOrder.address_snapshot.latitude},${singleOrder.address_snapshot.longitude}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Open in Google Maps</span>
                                </a>
                              </div>
                            )}

                            {/* Direct Communication Bar (WhatsApp 1-Click + Call + Email) */}
                            <div className="pt-2.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                {/* WhatsApp 1-Click Action */}
                                {(() => {
                                  const rawPhone = singleOrder.address_snapshot?.phone || singleOrder.customer_phone || '';
                                  const cleanPhone = rawPhone.replace(/\D/g, '');
                                  const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                  const custName = singleOrder.address_snapshot?.name || singleOrder.customer_name || 'Customer';
                                  const orderNum = singleOrder.order_number || singleOrder.id;
                                  const waText = encodeURIComponent(
                                    `Hello ${custName}, this is Vardhamrit Tea regarding your Order #${orderNum}.`
                                  );

                                  return cleanPhone ? (
                                    <a
                                      href={`https://wa.me/${waPhone}?text=${waText}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] font-bold text-xs rounded-xl border border-[#25D366]/30 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-2xs"
                                      title="Open direct WhatsApp conversation"
                                    >
                                      <MessageCircle className="w-3.5 h-3.5 fill-[#25D366] text-[#25D366]" />
                                      <span>WhatsApp</span>
                                    </a>
                                  ) : null;
                                })()}

                                {/* Direct Phone Call */}
                                <a
                                  href={`tel:${singleOrder.address_snapshot?.phone || singleOrder.customer_phone}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-200/80 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer shadow-2xs"
                                >
                                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>{singleOrder.address_snapshot?.phone || singleOrder.customer_phone || 'Call'}</span>
                                </a>
                              </div>

                              {/* Direct Email */}
                              {singleOrder.customer_email && (
                                <a
                                  href={`mailto:${singleOrder.customer_email}`}
                                  className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium truncate max-w-[200px] flex items-center gap-1 transition-colors"
                                  title={singleOrder.customer_email}
                                >
                                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{singleOrder.customer_email}</span>
                                </a>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ordered Chai Blends Itemized List */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <ShoppingBag className="w-4 h-4 text-emerald-800" />
                              <span>Ordered Chai Blends ({(singleOrder.items || []).length})</span>
                            </h4>
                            <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              {(singleOrder.items || []).reduce((acc: number, it: any) => acc + Number(it.quantity || 1), 0)} Total Packs
                            </span>
                          </div>

                          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                            {(singleOrder.items || []).map((it: any) => {
                              const img = getTeaImage(it.product_name);
                              return (
                                <div
                                  key={it.id}
                                  className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                                >
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-slate-50 to-white border border-slate-200 p-1 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                      <img
                                        src={img}
                                        alt={it.product_name}
                                        className="w-full h-full object-contain drop-shadow-xs"
                                      />
                                    </div>
                                    <div>
                                      <p className="font-black text-slate-900 text-xs leading-snug">{it.product_name}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[10.5px] font-bold border border-slate-200/60">
                                          {it.variant_label}
                                        </span>
                                        <span className="text-[10.5px] text-emerald-800 font-extrabold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                          Qty: {it.quantity}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="font-black text-slate-900 text-sm">
                                      ₹{(Number(it.price) * Number(it.quantity)).toFixed(2)}
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">₹{it.price} each</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Financial Billed Statement */}
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                              <FileText className="w-4 h-4 text-emerald-800" />
                              <span>Order Financial Statement</span>
                            </h4>
                            <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono">
                              OFFICIAL GST BREAKDOWN
                            </span>
                          </div>

                          {(() => {
                            const rawSubtotal = Number(singleOrder.subtotal || singleOrder.total || 0);
                            const couponDiscount = Number(singleOrder.discount_total || singleOrder.discount_amount || 0);
                            const coinsDiscount = Number(singleOrder.coins_discount || 0);
                            const coinsRedeemed = Number(singleOrder.coins_redeemed || 0);
                            const effectiveCoinsDiscount = coinsDiscount > 0 ? coinsDiscount : (coinsRedeemed > 0 ? coinsRedeemed : 0);
                            const totalSavings = couponDiscount + effectiveCoinsDiscount;
                            const actualItemAmount = Math.max(0, rawSubtotal - couponDiscount - effectiveCoinsDiscount);
                            const taxTotal = Number(singleOrder.tax_total || singleOrder.tax_amount || 0);
                            const deliveryFee = Number(singleOrder.delivery_fee || 0);
                            const netPayable = Number(singleOrder.total || singleOrder.total_amount || 0);

                            return (
                              <div className="bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                                {/* 1. Item MRP Subtotal */}
                                <div className="flex justify-between items-center text-slate-700 text-xs font-semibold">
                                  <span className="flex items-center gap-1.5">
                                    <ShoppingBag className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Tea Items Gross Subtotal (MRP)</span>
                                  </span>
                                  <span className="font-bold text-slate-900 font-mono">
                                    ₹{rawSubtotal.toFixed(2)}
                                  </span>
                                </div>

                                {/* 2. Promo / Voucher Discount */}
                                {couponDiscount > 0 && (
                                  <div className="flex justify-between items-center text-emerald-800 text-xs font-medium bg-emerald-50/80 px-2.5 py-1.5 rounded-lg border border-emerald-200/70">
                                    <span className="flex items-center gap-1.5">
                                      <Tag className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>
                                        Coupon / Voucher Discount {singleOrder.coupon_code ? `(${singleOrder.coupon_code})` : ''}
                                      </span>
                                    </span>
                                    <span className="font-black text-emerald-700 font-mono">
                                      -₹{couponDiscount.toFixed(2)}
                                    </span>
                                  </div>
                                )}

                                {/* 3. Vardhamrit Wallet Coins Discount */}
                                {effectiveCoinsDiscount > 0 && (
                                  <div className="flex justify-between items-center text-amber-900 text-xs font-medium bg-amber-50/80 px-2.5 py-1.5 rounded-lg border border-amber-200/70">
                                    <span className="flex items-center gap-1.5">
                                      <Coins className="w-3.5 h-3.5 text-amber-700" />
                                      <span>
                                        Vardhamrit Wallet Coins {coinsRedeemed > 0 ? `(${coinsRedeemed} Coins Redeemed)` : 'Redeemed'}
                                      </span>
                                    </span>
                                    <span className="font-black text-amber-800 font-mono">
                                      -₹{effectiveCoinsDiscount.toFixed(2)}
                                    </span>
                                  </div>
                                )}

                                {/* 4. Actual Net Item Value */}
                                {(couponDiscount > 0 || effectiveCoinsDiscount > 0) && (
                                  <div className="flex justify-between items-center text-xs pt-1.5 pb-1 border-t border-slate-200/70 font-semibold text-slate-800">
                                    <span className="flex items-center gap-1.5 text-slate-700">
                                      <span>Actual Net Amount of Items</span>
                                      <span className="text-[10.5px] text-emerald-700 font-medium">(Post-Discounts)</span>
                                    </span>
                                    <span className="font-black text-slate-900 font-mono">
                                      ₹{actualItemAmount.toFixed(2)}
                                    </span>
                                  </div>
                                )}

                                {/* 5. Detailed GST Breakdown */}
                                <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                                  <div className="flex justify-between items-center text-slate-700 text-xs font-semibold">
                                    <span className="flex items-center gap-1.5">
                                      <Receipt className="w-3.5 h-3.5 text-slate-500" />
                                      <span>GST (5% Integrated Food Tax)</span>
                                    </span>
                                    <span className="font-bold text-slate-900 font-mono">
                                      ₹{taxTotal.toFixed(2)}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 pl-5 pt-0.5">
                                    <div className="bg-white/80 px-2.5 py-1 rounded-md border border-slate-200/60 text-[11px] text-slate-600 flex justify-between">
                                      <span className="text-slate-500">CGST (2.5%):</span>
                                      <span className="font-mono font-semibold text-slate-800">₹{(taxTotal / 2).toFixed(2)}</span>
                                    </div>
                                    <div className="bg-white/80 px-2.5 py-1 rounded-md border border-slate-200/60 text-[11px] text-slate-600 flex justify-between">
                                      <span className="text-slate-500">SGST (2.5%):</span>
                                      <span className="font-mono font-semibold text-slate-800">₹{(taxTotal / 2).toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* 6. Express Assam Delivery */}
                                <div className="flex justify-between items-center text-slate-600 text-xs font-medium pt-2 border-t border-slate-200/70">
                                  <span className="flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Express Assam Delivery</span>
                                  </span>
                                  <span className="font-bold">
                                    {deliveryFee === 0 ? (
                                      <span className="text-emerald-700 font-black bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                        FREE DELIVERY
                                      </span>
                                    ) : (
                                      <span className="font-mono text-slate-900">₹{deliveryFee.toFixed(2)}</span>
                                    )}
                                  </span>
                                </div>

                                {/* 7. Savings Highlight Card */}
                                {totalSavings > 0 && (
                                  <div className="p-2.5 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/10 border border-emerald-300/60 flex items-center justify-between text-xs">
                                    <span className="text-emerald-900 font-bold flex items-center gap-1.5">
                                      <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                                      <span>Total Customer Savings</span>
                                    </span>
                                    <span className="font-black text-emerald-800 font-mono">
                                      ₹{totalSavings.toFixed(2)}
                                    </span>
                                  </div>
                                )}

                                {/* 8. Grand Total Highlight */}
                                <div className="pt-3 mt-1 border-t-2 border-dashed border-slate-200 flex justify-between items-center text-slate-900">
                                  <div>
                                    <span className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                                      Net Payable Amount
                                    </span>
                                    <span
                                      className={`text-[11px] font-bold ${singleOrder.payment_status === 'PAID' ? 'text-emerald-700' : 'text-amber-700'
                                        }`}
                                    >
                                      {singleOrder.payment_status === 'PAID'
                                        ? '✓ Fully Paid (Settled)'
                                        : '⚠️ Cash to be Collected at Delivery'}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-semibold block mt-0.5">
                                      Mode: <strong className="text-slate-700 uppercase">{singleOrder.payment_method || 'COD'}</strong>
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-2xl font-black text-emerald-950 font-mono tracking-tight">
                                      ₹{netPayable.toFixed(2)}
                                    </span>
                                    <p className="text-[10px] text-slate-400 font-medium">All taxes & charges included</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* ================================================================ */
                    /* AUDIT LOG & STATUS TIMELINE TAB */
                    /* ================================================================ */
                    <div className="p-6 space-y-6 flex-1 text-xs bg-slate-50/50">
                      {/* Timeline Card */}
                      <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                          <div>
                            <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                              <History className="w-4 h-4 text-emerald-800" />
                              <span>Complete Event Log & Order Audit Trail</span>
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Chronological record of status changes, admin dispatches, and notes
                            </p>
                          </div>
                          <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {(singleOrder.status_history || []).length} Recorded Events
                          </span>
                        </div>

                        {!(singleOrder.status_history && singleOrder.status_history.length > 0) ? (
                          <div className="p-8 text-center text-slate-400 space-y-1">
                            <Clock className="w-8 h-8 mx-auto text-slate-300 stroke-[1.5]" />
                            <p className="font-bold text-xs">No explicit audit events recorded yet</p>
                            <p className="text-[11px]">The order is in its initial '{singleOrder.status}' state.</p>
                          </div>
                        ) : (
                          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                            {singleOrder.status_history.map((event: any, idx: number) => {
                              const badge = getStatusBadge(event.status);
                              const isLatest = idx === singleOrder.status_history.length - 1;
                              return (
                                <div key={event.id || idx} className="relative group">
                                  {/* Dot */}
                                  <div
                                    className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isLatest
                                      ? 'bg-emerald-600 border-white ring-4 ring-emerald-100 text-white'
                                      : 'bg-white border-slate-300 text-slate-400'
                                      }`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full ${isLatest ? 'bg-white' : 'bg-slate-400'}`} />
                                  </div>

                                  {/* Event Card */}
                                  <div
                                    className={`p-4 rounded-2xl border transition-all ${isLatest
                                      ? 'bg-gradient-to-r from-emerald-50/50 to-white border-emerald-200/90 shadow-2xs'
                                      : 'bg-slate-50/60 border-slate-200/80'
                                      }`}
                                  >
                                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-0.5 rounded-full text-[10.5px] font-black uppercase border ${badge.bg}`}>
                                          {event.status}
                                        </span>
                                        {isLatest && (
                                          <span className="text-[9.5px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                                            Current State
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1 font-mono">
                                        <Calendar className="w-3 h-3 text-slate-400" />
                                        {new Date(event.created_at).toLocaleString('en-IN', {
                                          day: 'numeric',
                                          month: 'short',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                      </span>
                                    </div>

                                    <p className="text-xs text-slate-800 font-semibold leading-relaxed">
                                      {event.notes || `Status transitioned to ${event.status}`}
                                    </p>

                                    {event.changed_by && (
                                      <p className="text-[10.5px] text-slate-500 mt-2 flex items-center gap-1 font-medium">
                                        <User className="w-3 h-3 text-slate-400" />
                                        <span>
                                          Changed by: <strong className="text-slate-700">{event.changed_by}</strong>
                                        </span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Payment Transactions & Gateway Records */}
                      {singleOrder.payments && singleOrder.payments.length > 0 && (
                        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                              <CreditCard className="w-4 h-4 text-emerald-800" />
                              <span>Payment Gateway Records ({singleOrder.payments.length})</span>
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">RAZORPAY / CASH SETTLEMENTS</span>
                          </div>

                          <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
                            {singleOrder.payments.map((p: any) => (
                              <div key={p.id} className="p-3.5 flex items-center justify-between gap-3 text-xs">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-slate-900">{p.payment_method || singleOrder.payment_method}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${p.status === 'PAID' || p.status === 'SUCCESS' || p.status === 'CAPTURED'
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                                      }`}>
                                      {p.status}
                                    </span>
                                  </div>
                                  {p.gateway_payment_id && (
                                    <p className="text-[11px] font-mono text-slate-500">ID: {p.gateway_payment_id}</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="font-black font-mono text-slate-900 text-sm">₹{Number(p.amount || 0).toFixed(2)}</p>
                                  <p className="text-[10px] text-slate-400">
                                    {new Date(p.created_at).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* COURIER DISPATCH MODAL */}
      {/* ================================================================ */}
      {dispatchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDispatchModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                  <Truck className="w-5 h-5 text-purple-700" />
                </div>
                <div>
                  <h3 className="font-black text-base text-slate-900">Dispatch Tea Parcel</h3>
                  <p className="text-xs text-slate-500">Assign courier partner and AWB tracking</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Courier Partner Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Select Partner</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {COURIER_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCourierName(c)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all ${courierName === c
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                placeholder="Or custom courier name"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-700"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700">AWB Tracking Number *</label>
                <button
                  type="button"
                  onClick={() =>
                    setTrackingNumber(
                      `BD-${Math.floor(100000000 + Math.random() * 900000000)}`
                    )
                  }
                  className="text-[11px] font-bold text-purple-700 hover:underline"
                >
                  Generate Sample AWB
                </button>
              </div>
              <input
                type="text"
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value.toUpperCase())}
                placeholder="e.g. BD-984719284 or DEL-889102"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-black text-purple-950 focus:outline-none focus:ring-2 focus:ring-purple-700 tracking-wider"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDispatchModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={dispatchMutation.isPending || !trackingNumber}
                onClick={() => dispatchMutation.mutate()}
                className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
              >
                {dispatchMutation.isPending ? 'Dispatching...' : 'Confirm Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* REJECT & CANCEL MODAL */}
      {/* ================================================================ */}
      {rejectModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setRejectModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="font-black text-base text-rose-800">Reject & Cancel Order</h3>
                  <p className="text-xs text-slate-500">Provide reason for customer notification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Reason Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Common Reasons</label>
              <div className="space-y-1.5 mb-2">
                {REJECT_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectReason(r)}
                    className={`w-full text-left p-2 rounded-xl text-xs font-medium border transition-all ${rejectReason === r
                      ? 'bg-rose-50 border-rose-300 text-rose-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    • {r}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Or specify custom rejection reason..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={rejectMutation.isPending || !rejectReason}
                onClick={() => rejectMutation.mutate()}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
              >
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* ATTRACTIVE LUXURY FEEDBACK MODAL */}
      {/* ================================================================ */}
      {feedback && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
            {feedback.type === 'success' ? (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-emerald-50/50">
                <CheckCircle className="w-8 h-8 text-emerald-700 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-700 border-2 border-rose-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-rose-50/50">
                <XCircle className="w-8 h-8 text-rose-600 stroke-[2.5]" />
              </div>
            )}

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {feedback.title}
            </h3>

            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-2 mb-6 px-2">
              {feedback.message}
            </p>

            <button
              onClick={() => setFeedback(null)}
              className={`w-full py-3 rounded-2xl font-black text-xs shadow-sm transition-all active:scale-95 ${feedback.type === 'success'
                ? 'bg-emerald-800 hover:bg-emerald-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
                }`}
            >
              {feedback.type === 'success' ? 'Great, Got It' : 'Dismiss'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
