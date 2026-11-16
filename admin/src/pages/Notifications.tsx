import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Send,
  Zap,
  Coffee,
  ShoppingCart,
  Coins,
  Sparkles,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Radio,
  ExternalLink,
  Trash2,
  Copy,
  Users,
  ShieldCheck,
  RotateCcw,
  Eye,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  TrendingUp,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';

export const Notifications: React.FC = () => {
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState("PROMO");
  const [actionRoute, setActionRoute] = useState("/(tabs)");
  const [ctaText, setCtaText] = useState("View Now");
  const [targetAudience, setTargetAudience] = useState<'ALL' | 'ACTIVE_BUYERS' | 'INACTIVE' | 'SPECIFIC_USER'>('ALL');
  const [targetUserId, setTargetUserId] = useState<string>('');

  // UI state
  const [previewPlatform, setPreviewPlatform] = useState<'ios' | 'android'>('ios');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testTarget, setTestTarget] = useState('customer@vardhamrit.com');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Queries
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ['admin-notifications-stats'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/stats');
      return res.data?.data;
    },
    refetchInterval: 15000,
  });

  const { data: campaignsData, isLoading: loadingCampaigns, refetch: refetchCampaigns } = useQuery({
    queryKey: ['admin-notifications-campaigns'],
    queryFn: async () => {
      const res = await api.get('/admin/notifications/campaigns?limit=30');
      return res.data?.data;
    },
  });

  console.log(campaignsData, "campaignsData")

  const { data: productsData } = useQuery({
    queryKey: ['admin-products-picker'],
    queryFn: async () => {
      const res = await api.get('/products?limit=20');
      return res.data?.data?.items || [];
    },
  });

  // Broadcast Mutation
  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title,
        body,
        type,
        actionRoute,
        ctaText,
        targetAudience,
      };
      if (targetAudience === 'SPECIFIC_USER' && targetUserId) {
        payload.targetUserId = Number(targetUserId);
      }
      const res = await api.post('/admin/notifications/broadcast', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setConfirmModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Campaign broadcasted to ${data?.data?.totalRecipients || 0} users! (${data?.data?.pushTokensFound || 0} mobile push devices reached)`,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-stats'] });
      setTimeout(() => setFeedback(null), 8000);
    },
    onError: (err: any) => {
      setConfirmModalOpen(false);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to broadcast campaign';
      setFeedback({
        type: 'error',
        message: errorMsg,
      });
      setTimeout(() => setFeedback(null), 8000);
    },
  });

  // Test Push Mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/admin/notifications/test', {
        target: testTarget,
        title,
        body,
        type,
        actionRoute,
        ctaText,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setTestModalOpen(false);
      setFeedback({
        type: 'success',
        message: `Test push sent to ${data?.data?.user?.email || testTarget}! ${data?.data?.pushReason || ''}`,
      });
      setTimeout(() => setFeedback(null), 8000);
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to send test notification';
      setFeedback({
        type: 'error',
        message: errorMsg,
      });
      setTimeout(() => setFeedback(null), 8000);
    },
  });

  // Delete Campaign Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await api.delete(`/admin/notifications/campaigns/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Campaign record deleted successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['admin-notifications-stats'] });
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err: any) => {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        'Failed to delete campaign';
      setFeedback({
        type: 'error',
        message: errorMsg,
      });
      setTimeout(() => setFeedback(null), 8000);
    },
  });

  const copyCampaignToComposer = (camp: any) => {
    setTitle(camp.title);
    setBody(camp.body);
    setType(camp.type || 'PROMO');
    setActionRoute(camp.action_route || '/(tabs)');
    setCtaText(camp.cta_text || 'View Now');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
      <Header
        title="Push Notifications & Campaigns"
        subtitle="Deliver push alerts, flash sale drops & real-time customer nudges"
        onRefresh={() => {
          refetchStats();
          refetchCampaigns();
        }}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTestModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Send Test Push</span>
            </button>
            <button
              onClick={() => setConfirmModalOpen(true)}
              disabled={broadcastMutation.isPending || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Broadcast Now</span>
            </button>
          </div>
        }
      />

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 ${feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
          >
            <div className="flex items-center gap-3">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
              )}
              <span className="text-xs md:text-sm font-semibold">{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
              Dismiss
            </button>
          </div>
        )}

        {/* 1. Zepto Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Push Devices</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{statsData?.registeredTokens ?? 0}</h3>
              <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">Active Expo tokens</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Broadcasts</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{statsData?.totalCampaigns ?? 0}</h3>
              <p className="text-[11px] text-teal-600 font-semibold mt-0.5">{statsData?.totalPushSent ?? 0} push sent</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600">
              <Bell className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">In-App Inbox Alerts</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{statsData?.totalInAppDelivered ?? 0}</h3>
              <p className="text-[11px] text-amber-600 font-semibold mt-0.5">{statsData?.totalRead ?? 0} marked read</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Read / Open Rate</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{statsData?.readRate ?? 0}%</h3>
              <p className="text-[11px] text-indigo-600 font-semibold mt-0.5">High user engagement</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 3. Composer & Smartphone Live Mockup Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Campaign Composer Form (7 cols) */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-600" />
                  <span>Campaign Composer</span>
                </h3>
                <p className="text-xs text-slate-500">Draft rich push notification to broadcast</p>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-600">
                <span className="px-2 py-0.5 rounded-lg bg-white shadow-xs text-emerald-700">Real-Time Sync</span>
              </div>
            </div>

            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Target Audience Segment
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'ALL', label: 'All Customers', desc: `${statsData?.totalCustomers || 0} users` },
                  { id: 'ACTIVE_BUYERS', label: 'Active Buyers', desc: 'Repeat orders' },
                  { id: 'INACTIVE', label: 'Inactive Churn', desc: 'Win-back 30d' },
                  { id: 'SPECIFIC_USER', label: 'Specific User', desc: 'Direct test' },
                ].map((aud) => (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setTargetAudience(aud.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${targetAudience === aud.id
                      ? 'bg-emerald-50/80 border-emerald-500 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                      }`}
                  >
                    <p className="text-xs font-bold">{aud.label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{aud.desc}</p>
                  </button>
                ))}
              </div>

              {targetAudience === 'SPECIFIC_USER' && (
                <div className="mt-2.5">
                  <input
                    type="number"
                    placeholder="Enter Customer User ID (e.g., 2)"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
            </div>

            {/* Campaign Category Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Campaign Category
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'FLASH_SALE', label: 'Flash Sale', color: 'border-amber-300 text-amber-800 bg-amber-50' },
                  { id: 'CHAI_TIME', label: 'Chai Time', color: 'border-emerald-300 text-emerald-800 bg-emerald-50' },
                  { id: 'CART_REMINDER', label: 'Cart Reminder', color: 'border-blue-300 text-blue-800 bg-blue-50' },
                  { id: 'PROMO', label: 'Promo Offer', color: 'border-purple-300 text-purple-800 bg-purple-50' },
                  { id: 'ANNOUNCEMENT', label: 'Announcement', color: 'border-teal-300 text-teal-800 bg-teal-50' },
                  { id: 'ORDER_UPDATE', label: 'Order Status', color: 'border-slate-300 text-slate-800 bg-slate-50' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setType(cat.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${type === cat.id
                      ? `${cat.color} ring-2 ring-emerald-500/50 shadow-xs`
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notification Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Push Title
                </label>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. ⚡ Flash Deal: 25% Off Royal Masala Tea!"
                maxLength={100}
                className="w-full px-3.5 py-2.5 text-xs font-semibold rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
              />
              <div className="flex justify-between items-center text-[10.5px] text-slate-400 mt-1">
                <span>Keep under 50 characters for clean single-line lockscreens</span>
                <span>{title.length}/100</span>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Message Body
              </label>
              <textarea
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Describe your offer or reminder clearly with urgency..."
                maxLength={250}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs resize-none"
              />
              <div className="flex justify-between items-center text-[10.5px] text-slate-400 mt-1">
                <span>Include clear value proposition & promo code if applicable</span>
                <span>{body.length}/250</span>
              </div>
            </div>

            {/* Deep Link & CTA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Deep Link Route (In-App)
                </label>
                <select
                  value={actionRoute || '/(tabs)'}
                  onChange={(e) => setActionRoute(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs bg-white font-medium"
                >
                  <option value="/(tabs)">Home Screen</option>
                  <option value="/(tabs)/categories">Tea Categories Catalog</option>
                  <option value="/cart">Shopping Cart</option>
                  <option value="/wishlist">User Wishlist</option>
                  <option value="/(tabs)/profile">Profile & Wallet Coins</option>
                  <option value="/(tabs)/orders">Past Orders History</option>
                  {productsData && productsData.length > 0 && (
                    <optgroup label="Direct to Specific Product">
                      {productsData.slice(0, 8).map((p: any) => (
                        <option key={p.id} value={`/product/${p.id}`}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Call-to-Action (CTA Button)
                </label>
                <input
                  type="text"
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  placeholder="e.g. Order in 10 mins"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs"
                />
              </div>
            </div>

            {/* Composer Footer Actions */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Sends to Expo push servers + saves to customer in-app inbox</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTestModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors shadow-xs"
                >
                  Test Device
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmModalOpen(true)}
                  disabled={broadcastMutation.isPending || !title.trim() || !body.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast to All Users</span>
                </button>
              </div>
            </div>
          </div>

          {/* Smartphone Live Preview (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 flex flex-col items-center">
            <div className="w-full flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800">Live Device Simulation</h4>
              </div>

              {/* OS Selector */}
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                <button
                  onClick={() => setPreviewPlatform('ios')}
                  className={`px-2.5 py-1 rounded-md transition-all ${previewPlatform === 'ios' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                >
                  iPhone iOS
                </button>
                <button
                  onClick={() => setPreviewPlatform('android')}
                  className={`px-2.5 py-1 rounded-md transition-all ${previewPlatform === 'android' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                    }`}
                >
                  Android 14
                </button>
              </div>
            </div>

            {/* Simulated Phone Chassis */}
            <div className="w-full max-w-[320px] rounded-[36px] bg-slate-900 p-3 shadow-2xl border-4 border-slate-800 relative">
              {/* Dynamic Island / Notch */}
              <div className="w-24 h-4 bg-black rounded-full mx-auto mb-3 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900/90 ml-auto mr-2" />
              </div>

              {/* Lock screen background */}
              <div className="rounded-[26px] bg-gradient-to-b from-slate-900 via-emerald-950 to-slate-900 p-3 text-white min-h-[380px] flex flex-col justify-between relative overflow-hidden">
                {/* Clock header */}
                <div className="text-center pt-2">
                  <span className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">
                    VARDHAMRIT LIVE
                  </span>
                  <h2 className="text-3xl font-extralight tracking-tight text-white/90">04:00</h2>
                  <p className="text-[10px] text-amber-300 font-medium">Chai Time • Ready to Brew</p>
                </div>

                {/* The Zepto Notification Banner Card */}
                <div className="my-auto animate-in zoom-in-95 duration-200">
                  <div className="bg-slate-800/90 backdrop-blur-xl border border-white/15 rounded-2xl p-3 shadow-xl text-slate-100">
                    {/* App Bar */}
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-[9px] font-black text-emerald-950 shadow-xs">
                          V
                        </div>
                        <span className="text-[11px] font-black tracking-wide text-white">VARDHAMRIT</span>
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1 py-0.2 rounded font-bold">
                          ESTATE
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">now</span>
                    </div>

                    {/* Notification Title */}
                    <h5 className="text-xs font-extrabold text-white leading-tight">
                      {title || '⚡ Fresh Deal is Live!'}
                    </h5>

                    {/* Notification Body */}
                    <p className="text-[11px] text-slate-300 mt-1 leading-snug line-clamp-3">
                      {body || 'Tap to view the latest hand-picked garden teas and instant deals.'}
                    </p>

                    {/* CTA Button */}
                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between">
                      <span className="text-[10px] bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                        <span>{ctaText || 'View'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Home Indicator */}
                <div className="pb-1 text-center">
                  <div className="w-24 h-1 bg-white/40 rounded-full mx-auto" />
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 text-center">
              Real-time push preview showing banner rendering and rich media layout.
            </p>
          </div>
        </div>

        {/* 4. Past Campaigns History & Delivery Logs */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>Campaign History & Dispatch Logs</span>
              </h3>
              <p className="text-xs text-slate-500">Every notification campaign broadcasted to customers</p>
            </div>

            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-bold">
              {campaignsData?.total || 0} Total Campaigns
            </span>
          </div>

          {loadingCampaigns ? (
            <div className="p-8 text-center text-xs text-slate-500 font-bold">
              Loading campaign dispatch logs...
            </div>
          ) : campaignsData?.campaigns?.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                <Bell className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No campaigns launched yet</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Use the composer above or pick a template to dispatch your very first push campaign.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-600 uppercase font-black tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3.5 px-4">Campaign & Copy</th>
                    <th className="py-3.5 px-3">Type</th>
                    <th className="py-3.5 px-3">Audience</th>
                    <th className="py-3.5 px-3">Delivery Stats</th>
                    <th className="py-3.5 px-3">Deep Link</th>
                    <th className="py-3.5 px-3">Sent At</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {campaignsData?.campaigns?.map((camp: any) => (
                    <tr key={camp.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 max-w-xs">
                        <div className="flex items-start gap-2.5">
                          {camp.image_url ? (
                            <img
                              src={camp.image_url}
                              alt=""
                              className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600 font-bold">
                              <Bell className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-extrabold text-slate-900 truncate">{camp.title}</p>
                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{camp.body}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800">
                          {camp.type}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span className="font-semibold text-slate-800">{camp.target_audience}</span>
                      </td>

                      <td className="py-3 px-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-slate-900">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{camp.total_recipients} inboxes</span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            {camp.sent_count} Expo push sent
                          </p>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <code className="text-[10px] font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {camp.action_route || '/'}
                        </code>
                      </td>

                      <td className="py-3 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                        {new Date(camp.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => copyCampaignToComposer(camp)}
                            title="Reuse in composer"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-white hover:text-emerald-700 text-slate-500 transition-colors shadow-2xs"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget({ id: camp.id, title: camp.title })}
                            title="Delete record"
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors shadow-2xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Broadcast Confirmation Modal */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <Send className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Broadcast Campaign to Users?</h3>
              <p className="text-xs text-slate-500 mt-1">
                This will dispatch real-time push notifications to all users in the <b>{targetAudience}</b> segment
                and publish an in-app notification to their inbox.
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Title:</span>
                <span className="font-bold text-slate-900 truncate max-w-[240px]">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Category:</span>
                <span className="font-bold text-emerald-700">{type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="font-mono text-[11px] text-slate-700">{actionRoute}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => broadcastMutation.mutate()}
                disabled={broadcastMutation.isPending}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-950/20 disabled:opacity-50"
              >
                {broadcastMutation.isPending ? 'Broadcasting...' : 'Yes, Dispatch Broadcast'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Push Modal */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <Smartphone className="w-6 h-6" />
              </div>
              <button
                onClick={() => setTestModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Send Test Push to Device</h3>
              <p className="text-xs text-slate-500 mt-1">
                Enter an email or phone number to test device push notification before launching to everyone.
              </p>
            </div>

            {!title.trim() || !body.trim() ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Missing Content in Composer</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Please provide a Push Title and Message Body in the composer or pick a preset before testing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase">
                  <span>Push Preview</span>
                  <span>{type}</span>
                </div>
                <p className="font-bold text-slate-900">{title}</p>
                <p className="text-slate-500 text-[11px] line-clamp-2">{body}</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Email / Phone / ID</label>
              <input
                type="text"
                value={testTarget}
                onChange={(e) => setTestTarget(e.target.value)}
                placeholder="customer@vardhamrit.com or 2"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !testTarget.trim() || !title.trim() || !body.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-950/20 disabled:opacity-50"
              >
                {testMutation.isPending ? 'Sending...' : 'Send Test Notification'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Campaign Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
                <Trash2 className="w-6 h-6" />
              </div>
              <button
                onClick={() => setDeleteTarget(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <h3 className="text-base font-black text-slate-900">Delete Campaign Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently remove this notification campaign from the dispatch logs?
              </p>
            </div>

            <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-200/80 text-xs">
              <span className="text-slate-500 text-[11px] font-semibold uppercase tracking-wider">Campaign:</span>
              <p className="font-extrabold text-slate-900 mt-0.5 line-clamp-2">{deleteTarget.title}</p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteMutation.mutate(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 text-white text-xs font-bold shadow-md shadow-rose-950/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteMutation.isPending ? 'Deleting...' : 'Delete Campaign'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
