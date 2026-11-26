import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';
import {
  BellRing,
  PackageCheck,
  Users,
  CheckCircle2,
  Clock,
  Search,
  RefreshCw,
  Send,
  Sprout,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Layers,
  ListFilter,
  CheckSquare,
  Square,
  AlertTriangle,
  Megaphone,
} from 'lucide-react';
import { api, SOCKET_URL } from '../services/api';
import { Header } from '../components/Header';

interface StockSubscription {
  id: number;
  user_id: number | null;
  product_id: number;
  variant_id: number;
  contact_type: string;
  contact_value: string;
  is_notified: number | boolean;
  notified_at: string | null;
  created_at: string;
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  product_name: string;
  product_slug: string;
  variant_label: string;
  variant_price: number;
  variant_mrp: number;
  current_stock: number;
  product_image: string;
}

interface VariantGroup {
  variantId: number;
  productId: number;
  productName: string;
  productImage: string;
  variantLabel: string;
  variantPrice: number;
  currentStock: number;
  totalSubscribers: number;
  pendingCount: number;
  notifiedCount: number;
  subscriptions: StockSubscription[];
}

export const StockAlerts: React.FC = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'notified'>('all');
  const [viewMode, setViewMode] = useState<'grouped' | 'individual'>('grouped');

  // Expanded variant cards state (for grouped view)
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({});

  // Checkbox selection for individual table view
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Quick Restock Modal state
  const [restockModal, setRestockModal] = useState<{
    variantId: number;
    productName: string;
    variantLabel: string;
    currentStock: number;
    waitingCount: number;
  } | null>(null);
  const [newStockInput, setNewStockInput] = useState<string>('50');

  // Feedback banner state
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-stock-subscriptions', statusFilter, search],
    queryFn: async () => {
      const res = await api.get('/admin/stock-subscriptions', {
        params: {
          status: statusFilter !== 'all' ? statusFilter : undefined,
          search: search.trim() || undefined,
        },
      });
      return res.data?.data || { items: [], stats: { total: 0, pending: 0, notified: 0, uniqueProducts: 0 } };
    },
    refetchInterval: 20000,
  });

  const items: StockSubscription[] = data?.items || [];
  const stats = data?.stats || { total: 0, pending: 0, notified: 0, uniqueProducts: 0 };

  // Group items by variant_id
  const groupedVariants = useMemo<VariantGroup[]>(() => {
    const map = new Map<number, VariantGroup>();
    items.forEach((item) => {
      const vid = item.variant_id;
      if (!map.has(vid)) {
        map.set(vid, {
          variantId: vid,
          productId: item.product_id,
          productName: item.product_name,
          productImage: item.product_image,
          variantLabel: item.variant_label,
          variantPrice: Number(item.variant_price),
          currentStock: Number(item.current_stock || 0),
          totalSubscribers: 0,
          pendingCount: 0,
          notifiedCount: 0,
          subscriptions: [],
        });
      }
      const grp = map.get(vid)!;
      grp.totalSubscribers += 1;
      if (Boolean(item.is_notified)) {
        grp.notifiedCount += 1;
      } else {
        grp.pendingCount += 1;
      }
      grp.subscriptions.push(item);
    });
    return Array.from(map.values());
  }, [items]);

  const toggleExpand = (variantId: number) => {
    setExpandedVariants((prev) => ({
      ...prev,
      [variantId]: !prev[variantId],
    }));
  };

  // Real-time socket listener for instant reflection across screens
  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    const handleRefetch = () => {
      refetch();
    };

    socket.on('stock_alert.created', handleRefetch);
    socket.on('stock_alert.updated', handleRefetch);
    socket.on('stock_alert.notified', handleRefetch);
    socket.on('stock_alert.restocked', handleRefetch);
    socket.on('stock_alert.removed', handleRefetch);
    socket.on('catalog.updated', handleRefetch);

    return () => {
      socket.off('stock_alert.created', handleRefetch);
      socket.off('stock_alert.updated', handleRefetch);
      socket.off('stock_alert.notified', handleRefetch);
      socket.off('stock_alert.restocked', handleRefetch);
      socket.off('stock_alert.removed', handleRefetch);
      socket.off('catalog.updated', handleRefetch);
      socket.disconnect();
    };
  }, [refetch]);

  // Mutation: Trigger notification for ALL users waiting for a specific variant
  const notifyVariantMutation = useMutation({
    mutationFn: async ({ variantId, includeAlreadyNotified }: { variantId: number; includeAlreadyNotified?: boolean }) => {
      const res = await api.post(`/admin/stock-subscriptions/variant/${variantId}/notify`, {
        includeAlreadyNotified,
      });
      return res.data;
    },
    onSuccess: (res) => {
      setBanner({ type: 'success', message: res.message || 'Back-in-stock alerts dispatched to waiting customers!' });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      refetch();
      setTimeout(() => setBanner(null), 5000);
    },
    onError: (err: any) => {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch alerts.',
      });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  // Mutation: Trigger manual notification for a single subscription
  const notifySingleMutation = useMutation({
    mutationFn: async (subId: number) => {
      const res = await api.post(`/admin/stock-subscriptions/${subId}/notify`);
      return res.data;
    },
    onSuccess: (res) => {
      setBanner({ type: 'success', message: res.message || 'Customer notification dispatched!' });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      refetch();
      setTimeout(() => setBanner(null), 4000);
    },
    onError: (err: any) => {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch notification alert.',
      });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  // Mutation: Bulk notify selected subscriptions
  const bulkNotifyMutation = useMutation({
    mutationFn: async (subscriptionIds: number[]) => {
      const res = await api.post('/admin/stock-subscriptions/bulk-notify', { subscriptionIds });
      return res.data;
    },
    onSuccess: (res) => {
      setBanner({ type: 'success', message: res.message || 'Selected customer alerts dispatched!' });
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      refetch();
      setTimeout(() => setBanner(null), 5000);
    },
    onError: (err: any) => {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to dispatch selected alerts.',
      });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  // Mutation: Quick restock variant
  const restockMutation = useMutation({
    mutationFn: async ({ variantId, stockQuantity }: { variantId: number; stockQuantity: number }) => {
      const res = await api.post('/admin/stock-subscriptions/restock-variant', {
        variantId,
        stockQuantity,
      });
      return res.data;
    },
    onSuccess: (res) => {
      setBanner({ type: 'success', message: res.message || 'Variant inventory restocked and all waiting customers notified!' });
      setRestockModal(null);
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      refetch();
      setTimeout(() => setBanner(null), 5000);
    },
    onError: (err: any) => {
      setBanner({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update stock.',
      });
      setTimeout(() => setBanner(null), 5000);
    },
  });

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModal) return;
    const stockNum = parseInt(newStockInput, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      alert('Please enter a valid stock quantity');
      return;
    }
    restockMutation.mutate({ variantId: restockModal.variantId, stockQuantity: stockNum });
  };

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleToggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      let dateVal = dateStr;
      if (typeof dateStr === 'string' && !dateStr.endsWith('Z') && !dateStr.includes('+')) {
        dateVal = dateStr.replace(' ', 'T') + 'Z';
      }
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Out of Stock Alerts & Customer Waitlist"
        subtitle="Manage restock subscriptions: broadcast alerts to all waiting customers for each product with a single click"
        onRefresh={() => refetch()}
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* Feedback Banner */}
        {banner && (
          <div
            className={`p-4 rounded-2xl flex items-center justify-between border shadow-sm transition-all animate-in fade-in ${banner.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-rose-50 text-rose-900 border-rose-200'
              }`}
          >
            <div className="flex items-center gap-2.5">
              {banner.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="text-sm font-semibold">{banner.message}</span>
            </div>
            <button
              onClick={() => setBanner(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. KPI Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Total Subscriptions
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.total}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">All-time restock requests</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <BellRing className="w-5 h-5 text-emerald-700" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Waiting for Harvest
              </p>
              <h3 className="text-2xl font-black text-amber-600 mt-1">{stats.pending}</h3>
              <p className="text-[11px] text-amber-800 font-semibold mt-1">Pending alert dispatch</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Alerts Dispatched
              </p>
              <h3 className="text-2xl font-black text-emerald-700 mt-1">{stats.notified}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">Fulfilled & Notified</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Blends in Demand
              </p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{stats.uniqueProducts}</h3>
              <p className="text-[11px] text-slate-500 font-semibold mt-1">{groupedVariants.length} distinct pack sizes</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 flex items-center justify-center">
              <PackageCheck className="w-5 h-5 text-slate-700" />
            </div>
          </div>
        </div>

        {/* 2. Interactive Search, Filter, & View Mode Switcher */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-card-subtle flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by customer name, email, phone, blend name or package size..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle: Grouped by Product vs Individual List */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'grouped'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
                title="Group multiple requests for the same blend & size together"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Grouped by Product ({groupedVariants.length})</span>
              </button>
              <button
                onClick={() => setViewMode('individual')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${viewMode === 'individual'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
                title="View individual customer subscription entries"
              >
                <ListFilter className="w-3.5 h-3.5 text-slate-500" />
                <span>Individual Requests ({items.length})</span>
              </button>
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'all'
                  ? 'bg-white text-emerald-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'pending'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Waiting for Harvest ({stats.pending})
              </button>
              <button
                onClick={() => setStatusFilter('notified')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${statusFilter === 'notified'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                Fulfilled ({stats.notified})
              </button>
            </div>
          </div>
        </div>

        {/* 3. GROUPED VIEW: Eliminates repetitive manual alerts by aggregating all users per product & size */}
        {viewMode === 'grouped' && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/90 shadow-card-subtle text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                Loading out-of-stock subscriptions...
              </div>
            ) : groupedVariants.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-slate-200/90 shadow-card-subtle">
                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <BellRing className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">No restock subscriptions found</p>
                <p className="text-slate-400 text-xs mt-1">
                  When users click "Notify Me When Available", they will be organized here by product & size.
                </p>
              </div>
            ) : (
              groupedVariants.map((grp) => {
                const isOutOfStock = grp.currentStock <= 0;
                const hasPending = grp.pendingCount > 0;
                const isExpanded = Boolean(expandedVariants[grp.variantId]);

                return (
                  <div
                    key={grp.variantId}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden transition-all hover:border-emerald-200"
                  >
                    {/* Card Summary Header */}
                    <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 border-b border-slate-100">
                      {/* Product Thumbnail & Blend details */}
                      <div className="flex items-center gap-4 min-w-0">
                        <img
                          src={grp.productImage}
                          alt={grp.productName}
                          className="w-14 h-14 rounded-2xl object-contain bg-slate-50 border border-slate-200 p-1 shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 text-base truncate">
                              {grp.productName}
                            </h4>
                            <span className="text-xs font-black bg-amber-50 text-amber-900 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                              {grp.variantLabel}
                            </span>
                            <span className="font-extrabold text-slate-800 text-sm">
                              ₹{grp.variantPrice}
                            </span>
                          </div>

                          {/* Live Inventory & Subscription Breakdown */}
                          <div className="flex items-center gap-3 mt-2 flex-wrap text-xs">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                0 units (Sold Out)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                {grp.currentStock} units in stock
                              </span>
                            )}

                            <span className="text-slate-300">•</span>

                            <span className="font-bold text-slate-700 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{grp.totalSubscribers} total subscriber{grp.totalSubscribers === 1 ? '' : 's'}</span>
                            </span>

                            {hasPending ? (
                              <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-extrabold text-[11px]">
                                {grp.pendingCount} waiting for stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-extrabold text-[11px] flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                All {grp.notifiedCount} notified
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Unified Batch Fulfillment Actions: 1-Click for all users of this product */}
                      <div className="flex items-center gap-2.5 shrink-0 self-end md:self-center">
                        {/* Quick Restock & Auto-Notify Button */}
                        <button
                          onClick={() => {
                            setRestockModal({
                              variantId: grp.variantId,
                              productName: grp.productName,
                              variantLabel: grp.variantLabel,
                              currentStock: grp.currentStock,
                              waitingCount: grp.pendingCount,
                            });
                            setNewStockInput(String(Math.max(50, grp.currentStock + 50)));
                          }}
                          className="px-3.5 py-2 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shadow-2xs"
                          title="Restock this package size and auto-notify all waiting users"
                        >
                          <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Restock & Auto-Notify</span>
                        </button>

                        {/* Accordion Expand/Collapse */}
                        <button
                          onClick={() => toggleExpand(grp.variantId)}
                          className="p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-500 border border-slate-200 transition-colors"
                          title={isExpanded ? 'Collapse customer list' : 'View customer details'}
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Customer Details Table */}
                    {isExpanded && (
                      <div className="bg-slate-50/80 p-4 border-t border-slate-100">
                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                              <tr>
                                <th className="py-2.5 px-4">Customer</th>
                                <th className="py-2.5 px-4">Contact Destination</th>
                                <th className="py-2.5 px-4">Requested On</th>
                                <th className="py-2.5 px-4">Status</th>
                                <th className="py-2.5 px-4 text-right">Individual Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {grp.subscriptions.map((sub) => {
                                const isSubNotified = Boolean(sub.is_notified);
                                const contactValue = sub.contact_value || sub.user_email || sub.user_phone || 'In-App';
                                const customerName = sub.user_name || (sub.user_id ? `User #${sub.user_id}` : 'Guest');

                                return (
                                  <tr key={sub.id} className="hover:bg-slate-50/50">
                                    <td className="py-3 px-4 font-bold text-slate-900">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-800 font-black text-[10px] flex items-center justify-center">
                                          {customerName.charAt(0).toUpperCase()}
                                        </div>
                                        <span>{customerName}</span>
                                        {sub.user_id ? (
                                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                                            MEMBER
                                          </span>
                                        ) : null}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600">
                                      <span className="font-medium">{contactValue}</span>
                                      <span className="text-[10px] text-slate-400 block uppercase">
                                        Via {contactValue.includes('@') ? 'EMAIL' : /^\+?[0-9]{10,14}$/.test(contactValue) ? 'PHONE / WHATSAPP' : (sub.contact_type || 'PUSH')}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-slate-600">
                                      {formatDate(sub.created_at)}
                                    </td>
                                    <td className="py-3 px-4">
                                      {isSubNotified ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-[10px]">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                                          Notified {sub.notified_at ? formatDate(sub.notified_at) : ''}
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                                          Waiting for Harvest
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                      <button
                                        onClick={() => notifySingleMutation.mutate(sub.id)}
                                        disabled={notifySingleMutation.isPending}
                                        className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 hover:bg-emerald-50 hover:text-emerald-800 transition-colors inline-flex items-center gap-1 disabled:opacity-50"
                                        title="Alert this individual customer only"
                                      >
                                        {notifySingleMutation.isPending && (notifySingleMutation.variables as any) === sub.id ? (
                                          <RefreshCw className="w-2.5 h-2.5 text-emerald-600 animate-spin" />
                                        ) : (
                                          <Send className="w-2.5 h-2.5 text-emerald-600" />
                                        )}
                                        <span>
                                          {notifySingleMutation.isPending && (notifySingleMutation.variables as any) === sub.id
                                            ? 'Sending...'
                                            : (isSubNotified ? 'Re-send' : 'Alert')}
                                        </span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* 4. INDIVIDUAL VIEW: With bulk-select checkbox actions to alert multiple users at once */}
        {viewMode === 'individual' && (
          <div className="space-y-3">
            {/* Bulk Action Bar when checkboxes are selected */}
            {selectedIds.length > 0 && (
              <div className="bg-emerald-900 text-white p-3.5 rounded-2xl flex items-center justify-between shadow-md animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold">
                    {selectedIds.length} subscriber{selectedIds.length === 1 ? '' : 's'} selected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => bulkNotifyMutation.mutate(selectedIds)}
                    disabled={bulkNotifyMutation.isPending}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-3 h-3" />
                    <span>Dispatch Alerts to Selected ({selectedIds.length})</span>
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    className="px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-950 rounded-xl text-xs font-semibold text-emerald-200 transition-colors"
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Individual Subscriptions Data Table */}
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="py-4 px-4 w-10 text-center">
                        <button
                          onClick={handleSelectAll}
                          className="text-slate-400 hover:text-slate-600"
                          title="Select / Deselect All"
                        >
                          {selectedIds.length === items.length && items.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="py-4 px-6">Customer & Contact</th>
                      <th className="py-4 px-6">Requested Blend & Size</th>
                      <th className="py-4 px-6">Live Inventory</th>
                      <th className="py-4 px-6">Subscription Date</th>
                      <th className="py-4 px-6">Alert Status</th>
                      <th className="py-4 px-6 text-right">Fulfillment Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isLoading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                          Loading out-of-stock subscriptions...
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-16 text-center">
                          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                            <BellRing className="w-6 h-6" />
                          </div>
                          <p className="font-bold text-slate-700 text-sm">No restock subscriptions found</p>
                        </td>
                      </tr>
                    ) : (
                      items.map((row) => {
                        const isFulfilled = Boolean(row.is_notified);
                        const isOutOfStock = Number(row.current_stock) <= 0;
                        const contactValue = row.contact_value || row.user_email || row.user_phone || 'In-App Account';
                        const customerName = row.user_name || (row.user_id ? `User #${row.user_id}` : 'Guest Connoisseur');
                        const isSelected = selectedIds.includes(row.id);

                        // Find sibling subscribers waiting for the exact same variant
                        const sameVariantWaiting = items.filter(
                          (i) => i.variant_id === row.variant_id && !i.is_notified
                        ).length;

                        return (
                          <tr
                            key={row.id}
                            className={`hover:bg-slate-50/60 transition-colors ${isSelected ? 'bg-emerald-50/40' : ''
                              }`}
                          >
                            {/* Checkbox */}
                            <td className="py-4 px-4 text-center">
                              <button
                                onClick={() => handleToggleSelect(row.id)}
                                className="text-slate-400 hover:text-emerald-600"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-600" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>

                            {/* Customer */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-900 border border-emerald-200/60 flex items-center justify-center font-black text-xs shrink-0">
                                  {customerName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <p className="font-bold text-slate-900 truncate">{customerName}</p>
                                    {row.user_id ? (
                                      <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                                        MEMBER
                                      </span>
                                    ) : (
                                      <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                        GUEST
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                    {contactValue}
                                  </p>
                                  <span className="inline-block text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
                                    Via {contactValue.includes('@') ? 'EMAIL' : /^\+?[0-9]{10,14}$/.test(contactValue) ? 'PHONE / WHATSAPP' : (row.contact_type || 'PUSH')}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Blend & Variant */}
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                <img
                                  src={row.product_image}
                                  alt={row.product_name}
                                  className="w-10 h-10 rounded-lg object-contain bg-slate-50 border border-slate-200 p-0.5 shrink-0"
                                />
                                <div>
                                  <p className="font-bold text-slate-900">{row.product_name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                                      {row.variant_label}
                                    </span>
                                    <span className="font-extrabold text-slate-700">
                                      ₹{row.variant_price}
                                    </span>
                                    {sameVariantWaiting > 1 && (
                                      <span className="text-[9.5px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                                        {sameVariantWaiting} users waiting for this size
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Live Inventory */}
                            <td className="py-4 px-6">
                              {isOutOfStock ? (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  0 units (Sold Out)
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {row.current_stock} units in stock
                                </div>
                              )}
                            </td>

                            {/* Subscription Date */}
                            <td className="py-4 px-6">
                              <p className="text-slate-700 font-medium">{formatDate(row.created_at)}</p>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-6">
                              {isFulfilled ? (
                                <div>
                                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px]">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Notified
                                  </div>
                                  {row.notified_at && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                      {formatDate(row.notified_at)}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold text-[11px]">
                                  <Clock className="w-3 h-3 text-amber-600" />
                                  Waiting for Harvest
                                </div>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* Restock Variant Button */}
                                <button
                                  onClick={() => {
                                    setRestockModal({
                                      variantId: row.variant_id,
                                      productName: row.product_name,
                                      variantLabel: row.variant_label,
                                      currentStock: Number(row.current_stock || 0),
                                      waitingCount: sameVariantWaiting,
                                    });
                                    setNewStockInput(String(Math.max(50, Number(row.current_stock || 0) + 50)));
                                  }}
                                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded-xl font-bold text-xs transition-colors flex items-center gap-1"
                                  title="Restock this package size and auto-notify all waiting users"
                                >
                                  <Sprout className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Restock</span>
                                </button>

                                {/* Alert All Waiting for Same Variant (if multiple users) OR Single Alert */}
                                {sameVariantWaiting > 1 ? (
                                  <button
                                    onClick={() =>
                                      notifyVariantMutation.mutate({
                                        variantId: row.variant_id,
                                        includeAlreadyNotified: false,
                                      })
                                    }
                                    disabled={notifyVariantMutation.isPending}
                                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-xs"
                                    title={`Alert all ${sameVariantWaiting} customers waiting for this size`}
                                  >
                                    <Send className="w-3 h-3" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => notifySingleMutation.mutate(row.id)}
                                    disabled={notifySingleMutation.isPending}
                                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-60 ${isFulfilled
                                      ? 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                      : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
                                      }`}
                                    title={isFulfilled ? 'Send another restock alert' : 'Dispatch restock push alert now'}
                                  >
                                    {notifySingleMutation.isPending && (notifySingleMutation.variables as any) === row.id ? (
                                      <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                                    ) : (
                                      <Send className="w-3 h-3" />
                                    )}
                                    <span>
                                      {notifySingleMutation.isPending && (notifySingleMutation.variables as any) === row.id
                                        ? 'Sending...'
                                        : (isFulfilled ? 'Re-send' : 'Alert Now')}
                                    </span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 5. Quick Restock Modal */}
        {restockModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Quick Restock Inventory</h3>
                    <p className="text-xs text-slate-500">Automated Garden Restock Dispatcher</p>
                  </div>
                </div>
                <button
                  onClick={() => setRestockModal(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                <p className="text-xs text-slate-500 font-medium">Selected Blend & Size:</p>
                <p className="text-sm font-bold text-slate-900">
                  {restockModal.productName} ({restockModal.variantLabel})
                </p>
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-600">
                    Current Stock: <strong className="text-rose-600">{restockModal.currentStock} units</strong>
                  </span>
                  <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                    {restockModal.waitingCount} waiting customer{restockModal.waitingCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>

              <form onSubmit={handleRestockSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    New Available Inventory (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newStockInput}
                    onChange={(e) => setNewStockInput(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                  />
                  <p className="text-[11px] text-emerald-700 mt-1.5 flex items-center gap-1 font-medium">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Setting stock &gt; 0 automatically alerts ALL {restockModal.waitingCount} waiting customers via Push & In-App!
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setRestockModal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restockMutation.isPending}
                    className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-950/20 transition-all flex items-center gap-2"
                  >
                    {restockMutation.isPending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Notify All {restockModal.waitingCount} Customers</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default StockAlerts;
