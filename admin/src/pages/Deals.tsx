import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Flame,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  Clock,
  Calendar,
  AlertCircle,
  Sparkles,
  Tag,
  CheckCircle2,
  Zap,
  RefreshCw,
  Eye,
  Power,
  Package,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';

export interface DealItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  subtitle: string;
  image_url: string | null;
  deal_price: number;
  original_price: number;
  discount_percent: number;
  start_time: string;
  end_time: string;
  is_active: number | boolean;
  created_at: string;
  product_name: string;
  product_category: string;
  product_category_slug: string;
  product_image: string | null;
  variant_label: string;
  current_variant_price: number;
  current_variant_mrp: number;
  status: 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'DISABLED';
}

export const Deals: React.FC = () => {
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<DealItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; title: string } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState<number | ''>('');
  const [selectedVariantId, setSelectedVariantId] = useState<number | ''>('');
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [dealPrice, setDealPrice] = useState<number | ''>('');
  const [originalPrice, setOriginalPrice] = useState<number | ''>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [durationPreset, setDurationPreset] = useState<'24h' | 'midnight' | '3d' | '7d' | 'custom'>('24h');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Fetch Deals
  const { data: deals = [], isLoading, refetch } = useQuery<DealItem[]>({
    queryKey: ['admin-deals'],
    queryFn: async () => {
      const res = await api.get('/admin/deals');
      return res.data?.data || [];
    },
    refetchInterval: 15000,
  });

  console.log(deals, "deals")

  // Fetch Catalog Products for Product Dropdown
  const { data: productsData } = useQuery({
    queryKey: ['admin-products-for-deals'],
    queryFn: async () => {
      const res = await api.get('/products', { params: { limit: 100 } });
      return res.data?.data?.items || [];
    },
  });

  const productsList = useMemo(() => productsData || [], [productsData]);

  // Current selected product object
  const currentProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return productsList.find((p: any) => Number(p.id) === Number(selectedProductId)) || null;
  }, [productsList, selectedProductId]);

  // Variants of current selected product
  const currentVariants = useMemo(() => {
    return currentProduct?.variants || [];
  }, [currentProduct]);

  // When product changes, reset or pick first variant
  const handleProductChange = (prodId: number) => {
    setSelectedProductId(prodId);
    const prod = productsList.find((p: any) => Number(p.id) === Number(prodId));
    if (prod && prod.variants?.length > 0) {
      const firstVar = prod.variants[0];
      setSelectedVariantId(firstVar.id);
      const mrp = Number(firstVar.mrp || firstVar.price || 299);
      setOriginalPrice(mrp);
      const dPrice = Math.round(mrp * 0.75); // 25% off default suggestion
      setDealPrice(dPrice);
      setDiscountPercent(Math.round(((mrp - dPrice) / mrp) * 100));
      setTitle(`${prod.name} (${firstVar.label} Family Pack)`);
      setSubtitle(`${firstVar.label} Bestseller CTC Pack • Fresh Garden Vacuum Sealed`);
    } else {
      setSelectedVariantId('');
    }
  };

  // When variant changes, update prices & suggestions
  const handleVariantChange = (varId: number) => {
    setSelectedVariantId(varId);
    const v = currentVariants.find((item: any) => Number(item.id) === Number(varId));
    if (v && currentProduct) {
      const mrp = Number(v.mrp || v.price || 299);
      setOriginalPrice(mrp);
      const dPrice = Math.round(mrp * 0.75);
      setDealPrice(dPrice);
      setDiscountPercent(Math.round(((mrp - dPrice) / mrp) * 100));
      setTitle(`${currentProduct.name} (${v.label} Saver Deal)`);
      setSubtitle(`${v.label} Special Blend • Direct Harvest Upper Assam`);
    }
  };

  // Live recalculate discount percent when dealPrice or originalPrice changes
  useEffect(() => {
    const o = Number(originalPrice);
    const d = Number(dealPrice);
    if (o > 0 && d > 0 && o >= d) {
      setDiscountPercent(Math.round(((o - d) / o) * 100));
    }
  }, [dealPrice, originalPrice]);

  // Calculate start & end times based on preset
  useEffect(() => {
    if (durationPreset === 'custom') return;
    const now = new Date();
    setStartTime(now.toISOString().slice(0, 16));

    if (durationPreset === '24h') {
      const end = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      setEndTime(end.toISOString().slice(0, 16));
    } else if (durationPreset === 'midnight') {
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      setEndTime(end.toISOString().slice(0, 16));
    } else if (durationPreset === '3d') {
      const end = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
      setEndTime(end.toISOString().slice(0, 16));
    } else if (durationPreset === '7d') {
      const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      setEndTime(end.toISOString().slice(0, 16));
    }
  }, [durationPreset]);

  // Active deals (all deals with status ACTIVE)
  const activeDeals = useMemo(() => {
    return deals.filter((d) => d.status === 'ACTIVE');
  }, [deals]);

  const openCreateModal = () => {
    setEditingDeal(null);
    if (productsList.length > 0) {
      const first = productsList[0];
      setSelectedProductId(first.id);
      if (first.variants?.length > 0) {
        const v = first.variants[0];
        setSelectedVariantId(v.id);
        const mrp = Number(v.mrp || v.price || 385);
        setOriginalPrice(mrp);
        const dp = Math.round(mrp * 0.7);
        setDealPrice(dp);
        setDiscountPercent(Math.round(((mrp - dp) / mrp) * 100));
        setTitle(`${first.name} (Special ${v.label} Pack)`);
        setSubtitle(`${v.label} Bestseller CTC Pack • Fresh Vacuum Sealed`);
      }
    } else {
      setSelectedProductId('');
      setSelectedVariantId('');
      setTitle('Deal of the Day');
      setSubtitle('Fresh Garden Harvest Limited Deal');
      setDealPrice(249);
      setOriginalPrice(385);
      setDiscountPercent(35);
    }
    setCustomImageUrl('');
    setDurationPreset('24h');
    setIsActive(true);
    setModalOpen(true);
  };

  const openEditModal = (deal: DealItem) => {
    setEditingDeal(deal);
    setSelectedProductId(deal.product_id);
    setSelectedVariantId(deal.variant_id);
    setTitle(deal.title);
    setSubtitle(deal.subtitle);
    setDealPrice(Number(deal.deal_price));
    setOriginalPrice(Number(deal.original_price));
    setDiscountPercent(deal.discount_percent);
    setCustomImageUrl(deal.image_url || '');
    setDurationPreset('custom');
    if (deal.start_time) {
      setStartTime(new Date(deal.start_time).toISOString().slice(0, 16));
    }
    if (deal.end_time) {
      setEndTime(new Date(deal.end_time).toISOString().slice(0, 16));
    }
    setIsActive(Boolean(deal.is_active));
    setModalOpen(true);
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/admin/deals', {
        productId: selectedProductId,
        variantId: selectedVariantId,
        title,
        subtitle,
        dealPrice: Number(dealPrice),
        originalPrice: Number(originalPrice),
        discountPercent: Number(discountPercent),
        imageUrl: customImageUrl.trim() || undefined,
        startTime: startTime ? new Date(startTime).toISOString() : new Date().toISOString(),
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      setModalOpen(false);
      setFeedback({
        type: 'success',
        title: 'Deal of the Day Created!',
        message: 'The new dynamic Deal of the Day is now live on the customer mobile app.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Creation Failed',
        message: err.response?.data?.error || err.message || 'Could not create deal.',
      });
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingDeal) return;
      await api.put(`/admin/deals/${editingDeal.id}`, {
        productId: selectedProductId,
        variantId: selectedVariantId,
        title,
        subtitle,
        dealPrice: Number(dealPrice),
        originalPrice: Number(originalPrice),
        discountPercent: Number(discountPercent),
        imageUrl: customImageUrl.trim() || undefined,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      setModalOpen(false);
      setFeedback({
        type: 'success',
        title: 'Deal of the Day Updated!',
        message: 'The deal changes have been published and synced live with the app.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Update Failed',
        message: err.response?.data?.error || err.message || 'Could not update deal.',
      });
    },
  });

  // Toggle Active Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, nextStatus }: { id: number; nextStatus: boolean }) => {
      await api.patch(`/admin/deals/${id}/status`, { isActive: nextStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      setFeedback({
        type: 'success',
        title: 'Status Updated',
        message: 'Deal status changed successfully and synced with mobile app.',
      });
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-deals'] });
      setDeleteConfirm(null);
      setFeedback({
        type: 'success',
        title: 'Deal Deleted',
        message: 'The promotion has been removed.',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedVariantId) {
      alert('Please select a product and a variant.');
      return;
    }
    if (!dealPrice || Number(dealPrice) <= 0) {
      alert('Please enter a valid deal price.');
      return;
    }
    if (editingDeal) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const formatCountdown = (endStr: string) => {
    const end = new Date(endStr).getTime();
    const diff = end - Date.now();
    if (diff <= 0) return 'Expired';
    const hrs = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hrs}h ${mins}m left`;
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-gray-50 to-emerald-50/20">
      <Header
        title="Deal of the Day & Live Flash Sales"
        subtitle="Dynamic estate promotions, high-energy countdowns, and mobile app flash banners"
        onRefresh={() => refetch()}
      />

      <main className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        {/* Page Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-rose-900/20">
                <Flame className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
                  Deal of the Day
                  <span className="text-xs font-bold uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                    Live Marketing
                  </span>
                </h1>
                <p className="text-sm text-gray-500 font-medium">
                  Dynamic high-energy flash deal displayed on the mobile app home screen with live countdown.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="p-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition shadow-xs"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-bold shadow-lg shadow-emerald-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Set Deal of the Day</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 shadow-xs ${feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-sm">
              <div className="font-bold">{feedback.title}</div>
              <div className="text-xs opacity-90 mt-0.5">{feedback.message}</div>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ACTIVE DEALS SPOTLIGHT SECTION */}
        {activeDeals.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 bg-rose-500/15 text-rose-700 border border-rose-300 text-xs font-black px-2.5 py-1 rounded-full">
                  <Flame className="w-3.5 h-3.5 text-rose-600 fill-rose-600 animate-pulse" />
                  LIVE ON MOBILE APP ( {activeDeals.length} DEALS ACTIVE )
                </span>
                <span className="text-xs text-gray-500 font-medium">
                  Visitors swipe horizontally through these deals on the home screen.
                </span>
              </div>
            </div>

            <div className={activeDeals.length === 1 ? 'grid grid-cols-1' : 'grid grid-cols-1 md:grid-cols-2 gap-4'}>
              {activeDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F5132] via-[#0D442A] to-[#0A3622] text-white p-5 shadow-xl border border-emerald-700/40"
                >
                  <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                  <div className="relative z-10 flex flex-col justify-between h-full gap-4">
                    <div className="flex items-start gap-4">
                      <div className="relative w-20 h-20 rounded-xl bg-white/10 backdrop-blur-md p-1.5 border border-white/20 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                        <img
                          src={deal.image_url || deal.product_image || 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=400'}
                          alt={deal.title}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-1 right-1 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow">
                          -{deal.discount_percent}%
                        </div>
                      </div>

                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="flex items-center gap-1 bg-white/15 text-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />
                            {formatCountdown(deal.end_time)}
                          </span>
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-1.5 py-0.5 rounded">
                            {deal.variant_label || 'Pack'}
                          </span>
                        </div>

                        <h2 className="text-base font-black text-white tracking-tight line-clamp-1">{deal.title}</h2>
                        <p className="text-[11px] text-emerald-200/80 font-medium line-clamp-1">{deal.subtitle}</p>

                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xl font-black text-amber-300">₹{deal.deal_price}</span>
                          <span className="text-xs text-emerald-300/60 line-through font-semibold">₹{deal.original_price}</span>
                          <span className="text-[10px] text-emerald-200/70 font-medium truncate">
                            {deal.product_name}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-amber-900">No Active Deals of the Day</h3>
                <p className="text-xs text-amber-700/90 mt-0.5">
                  Currently no promotional deals are active. Activate one or more deals below, and they will appear in a horizontal scroll on the mobile app.
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-900/10 transition shrink-0"
            >
              Activate a Deal Now
            </button>
          </div>
        )}

        {/* ALL DEALS HISTORY / LIST */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-gray-900 text-base">Promotions & Deals History</h3>
              <p className="text-xs text-gray-500">All configured flash deals, past campaigns, and future schedules.</p>
            </div>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {deals.length} Total Deals
            </span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400 text-sm font-medium">Loading deals...</div>
          ) : deals.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <Flame className="w-8 h-8 text-gray-300 mx-auto" />
              <div className="text-sm font-bold text-gray-700">No deals created yet</div>
              <p className="text-xs text-gray-500">Create your first Deal of the Day to boost high-margin daily tea sales.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Deal Product</th>
                    <th className="py-3 px-4">Variant & Prices</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4">Duration & Schedule</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map((deal) => {
                    const isDealActive = deal.status === 'ACTIVE';
                    return (
                      <tr key={deal.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-gray-100 p-1 border border-gray-200 shrink-0 overflow-hidden flex items-center justify-center">
                              <img
                                src={deal.image_url || deal.product_image || 'https://images.unsplash.com/photo-1597481499750-3e6b22637e12?auto=format&fit=crop&q=80&w=200'}
                                alt=""
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div>
                              <div className="font-extrabold text-gray-900 line-clamp-1">{deal.title}</div>
                              <div className="text-[11px] text-gray-500 line-clamp-1">{deal.product_name}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-bold text-emerald-800">₹{deal.deal_price}</div>
                          <div className="text-[11px] text-gray-400 line-through">₹{deal.original_price}</div>
                          <div className="text-[10px] text-gray-500 font-medium">({deal.variant_label})</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-black text-rose-600 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            {deal.discount_percent}% OFF
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-gray-600">
                          <div className="font-medium">
                            {new Date(deal.start_time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            to {new Date(deal.end_time).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {deal.status === 'ACTIVE' && (
                            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              ACTIVE
                            </span>
                          )}
                          {deal.status === 'SCHEDULED' && (
                            <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-blue-200">
                              SCHEDULED
                            </span>
                          )}
                          {deal.status === 'EXPIRED' && (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-gray-200">
                              EXPIRED
                            </span>
                          )}
                          {deal.status === 'DISABLED' && (
                            <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-rose-200">
                              DISABLED
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  id: deal.id,
                                  nextStatus: !deal.is_active,
                                })
                              }
                              className={`p-1.5 rounded-lg border text-xs font-bold transition ${deal.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                }`}
                              title={deal.is_active ? 'Deactivate' : 'Activate as Deal of the Day'}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openEditModal(deal)}
                              className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm({ id: deal.id, title: deal.title })}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      </main>

      {/* CREATE / EDIT DEAL MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-gray-100 overflow-hidden my-8">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/30 border border-rose-400/40 flex items-center justify-center text-rose-300">
                  <Flame className="w-4 h-4 fill-rose-300" />
                </div>
                <div>
                  <h3 className="font-black text-sm tracking-wide">
                    {editingDeal ? 'Edit Deal of the Day' : 'Configure New Deal of the Day'}
                  </h3>
                  <p className="text-[11px] text-emerald-200/80">Direct live mobile customer display</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-emerald-300 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
              {/* Product Select */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">Select Tea Blend</label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductChange(Number(e.target.value))}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                  required
                >
                  <option value="" disabled>-- Choose a Tea Blend --</option>
                  {productsList.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.category || 'Special Blend'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Variant Select */}
              {currentVariants.length > 0 && (
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Pack Size / Variant</label>
                  <select
                    value={selectedVariantId}
                    onChange={(e) => handleVariantChange(Number(e.target.value))}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                    required
                  >
                    {currentVariants.map((v: any) => (
                      <option key={v.id} value={v.id}>
                        {v.label} (Current MRP: ₹{v.mrp || v.price} | Stock: {v.stock_quantity ?? v.stock ?? 0})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title & Subtitle */}
              <div className="space-y-3">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Headline Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Normal Kadak Chai (Special 500g Family Pack)"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subtitle / Key Selling Hook</label>
                  <input
                    type="text"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="e.g. 500g Bestseller CTC Pack • Fresh Vacuum Sealed"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Pricing Grid */}
              <div className="grid grid-cols-3 gap-3 p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">Deal Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={dealPrice}
                    onChange={(e) => setDealPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-white border border-emerald-300 rounded-lg font-black text-emerald-900 text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-gray-600 mb-1">Original MRP (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value ? Number(e.target.value) : '')}
                    className="w-full p-2 bg-white border border-gray-300 rounded-lg font-bold text-gray-700 text-sm outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-rose-700 mb-1">Calculated OFF</label>
                  <div className="p-2 bg-white border border-rose-300 rounded-lg font-black text-rose-600 text-sm text-center">
                    {discountPercent}% OFF
                  </div>
                </div>
              </div>

              {/* Duration Presets */}
              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Deal Duration</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: '24h', label: '24 Hours' },
                    { id: 'midnight', label: 'Tonight' },
                    { id: '3d', label: '3 Days' },
                    { id: '7d', label: '7 Days' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setDurationPreset(p.id as any)}
                      className={`p-2 rounded-lg font-bold text-center border transition ${durationPreset === p.id
                        ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-2.5">
                  <div>
                    <label className="block text-[10px] text-gray-500 font-semibold mb-0.5">Start Time</label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value);
                        setDurationPreset('custom');
                      }}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] text-gray-500 font-semibold mb-0.5">End Time</label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value);
                        setDurationPreset('custom');
                      }}
                      className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Custom Image URL (Optional) */}
              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Custom Deal Image URL <span className="text-gray-400 font-normal">(Optional, defaults to product pouch)</span>
                </label>
                <input
                  type="url"
                  value={customImageUrl}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  placeholder="https://... or leave empty to use tea image"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-medium text-gray-900 focus:bg-white focus:border-emerald-600 outline-none"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div>
                  <div className="font-bold text-gray-800">Activate Immediately</div>
                  <div className="text-[10px] text-gray-500">
                    If enabled, this will become the active live Deal of the Day on the mobile app.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${isActive ? 'bg-emerald-600 justify-end' : 'bg-gray-300 justify-start'
                    }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-900/10 transition flex items-center gap-1.5"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{editingDeal ? 'Update Deal' : 'Publish Deal'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-gray-100">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-gray-900 text-base">Delete Deal?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Are you sure you want to delete "{deleteConfirm.title}"? If active, it will disappear from customer devices immediately.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 font-bold text-xs hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm.id)}
                className="flex-1 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 shadow-md shadow-rose-900/10"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
