import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Ticket,
  X,
  Copy,
  Check,
  Percent,
  Sparkles,
  TrendingUp,
  Tag,
  Calendar,
  AlertCircle,
  LayoutGrid,
  List,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';

export const Coupons: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
    code?: string;
  } | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [type, setType] = useState<'PERCENT' | 'FLAT'>('PERCENT');
  const [value, setValue] = useState(15);
  const [maxDiscountCap, setMaxDiscountCap] = useState(150);
  const [minOrderValue, setMinOrderValue] = useState(299);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [usageLimitTotal, setUsageLimitTotal] = useState(500);
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(1);
  const [paymentRestriction, setPaymentRestriction] = useState<'ALL' | 'ONLINE' | 'COD'>('ALL');
  const [isFirstOrderOnly, setIsFirstOrderOnly] = useState(false);

  const getValidityBadge = (validToStr?: string) => {
    if (!validToStr) return 'No expiry date';
    const expiry = new Date(validToStr);
    const diffMs = expiry.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Expired';
    if (diffDays === 0) return 'Expires today';
    if (diffDays === 1) return 'Expires tomorrow';
    if (diffDays > 365) return `Valid until ${expiry.getFullYear()}`;
    return `Valid for ${diffDays} days`;
  };

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin-coupons'],
    queryFn: async () => {
      const res = await api.get('/admin/coupons');
      return res.data?.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const expiryDate = new Date(Date.now() + Number(validityDays || 30) * 24 * 60 * 60 * 1000);
      const validFrom = now.toISOString().slice(0, 19).replace('T', ' ');
      const validTo = expiryDate.toISOString().slice(0, 19).replace('T', ' ');
      await api.post('/admin/coupons', {
        code,
        type,
        discount_type: type,
        value,
        discount_value: value,
        maxDiscountCap,
        max_discount: maxDiscountCap,
        minOrderValue,
        min_order_value: minOrderValue,
        usageLimitTotal,
        usage_limit_total: usageLimitTotal,
        usageLimitPerUser,
        isFirstOrderOnly,
        is_first_order_only: isFirstOrderOnly,
        validFrom,
        validTo,
        paymentRestriction,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
      const createdCode = code;
      setModalOpen(false);
      setCode('');
      setIsFirstOrderOnly(false);
      setValidityDays(30);
      setFeedback({
        type: 'success',
        title: 'Coupon Created Successfully!',
        message: `Promo code "${createdCode}" has been created with ${validityDays} days validity and is now active for checkout.`,
        code: createdCode,
      });
    },
    onError: (err: any) => {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to create coupon';
      setFeedback({
        type: 'error',
        title: 'Unable to Create Coupon',
        message: errorMsg,
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      await api.put(`/admin/coupons/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Status Update Failed',
        message: err.response?.data?.error || err.message || 'Failed to update coupon status',
      });
    },
  });

  const handleCopy = (couponCode: string) => {
    navigator.clipboard.writeText(couponCode);
    setCopiedCode(couponCode);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const totalDiscountGranted = (coupons || []).reduce(
    (sum: number, c: any) => sum + Number(c.total_discount_given || 0),
    0
  );
  const totalRedemptions = (coupons || []).reduce(
    (sum: number, c: any) => sum + Number(c.total_used || 0),
    0
  );

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Promotions, Coupons & Vouchers"
        subtitle="Manage discounts, promo codes, minimum order rules, and redemption caps"
        actions={
          <button
            onClick={() => setModalOpen(true)}
            className="bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Create Promo Code</span>
          </button>
        }
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Promo Codes</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {(coupons || []).filter((c: any) => c.is_active).length}
              </h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">Ready for checkout</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-emerald-700" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Redemptions</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalRedemptions}</h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">Claimed by customers</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-amber-700" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Discounts Given</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                ₹{totalDiscountGranted.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </h3>
              <p className="text-[11px] text-purple-700 font-semibold mt-1">Customer savings</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-700" />
            </div>
          </div>
        </div>

        {/* View Switcher & Title */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-black text-slate-900">Tea Lovers Promo Codes</h3>
            <p className="text-xs text-slate-500">Configure vouchers for festivals, seasonal harvests & new customer acquisition.</p>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'cards' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              title="Voucher cards view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cards or Table */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading coupons...</p>
          </div>
        ) : (coupons || []).length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200 space-y-3">
            <Ticket className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No active promo codes created yet.</p>
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs font-bold text-emerald-800 hover:underline"
            >
              Create your first promotional discount
            </button>
          </div>
        ) : viewMode === 'cards' ? (
          /* Modern Voucher Cards View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coupons.map((c: any) => {
              const usageLimit = c.usage_limit_total || 500;
              const used = c.total_used || 0;
              const percentUsed = Math.min(100, Math.round((used / usageLimit) * 100));
              const discountType = c.discount_type || c.type || 'PERCENT';
              const isPercent = discountType === 'PERCENT';
              const discountValue = Number(c.discount_value ?? c.value ?? 0);
              const maxDiscountCap = c.max_discount ?? c.max_discount_cap;

              return (
                <div
                  key={c.id}
                  className={`relative rounded-3xl p-5 border transition-all duration-200 shadow-card-subtle flex flex-col justify-between overflow-hidden ${c.is_active
                      ? 'bg-white border-slate-200/90 hover:shadow-card-elevated hover:-translate-y-0.5'
                      : 'bg-slate-50/70 border-slate-200 opacity-60'
                    }`}
                >
                  <div>
                    {/* Top Tag & Status */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-emerald-700" />
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                          {isPercent ? 'Percentage Voucher' : 'Flat Cash Voucher'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${c.is_active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-600'
                            }`}
                        >
                          {c.is_active ? 'ACTIVE' : 'DISABLED'}
                        </span>
                        {(Boolean(c.is_first_order_only) || c.code === 'WELCOMEFIRST') && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            FIRST ORDER
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Voucher Code Block */}
                    <div className="p-3 bg-gradient-to-r from-emerald-950 to-[#0A3521] text-white rounded-2xl flex items-center justify-between mb-4 shadow-sm border border-emerald-800/40">
                      <div>
                        <p className="text-[9.5px] uppercase font-bold text-emerald-300">Promo Code</p>
                        <p className="font-mono font-black text-lg tracking-wider text-amber-300">{c.code}</p>
                      </div>
                      <button
                        onClick={() => handleCopy(c.code)}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors"
                        title="Copy code"
                      >
                        {copiedCode === c.code ? (
                          <Check className="w-4 h-4 text-emerald-300" />
                        ) : (
                          <Copy className="w-4 h-4 text-slate-200" />
                        )}
                      </button>
                    </div>

                    {/* Discount Summary */}
                    <div className="space-y-1.5 mb-4">
                      {c.title && (
                        <p className="text-xs font-bold text-slate-700 truncate" title={c.title}>
                          {c.title}
                        </p>
                      )}
                      <div className="flex items-baseline gap-1 text-slate-900">
                        <span className="text-xl font-black">
                          {isPercent ? `${discountValue}% OFF` : `₹${discountValue} OFF`}
                        </span>
                        {maxDiscountCap && isPercent && (
                          <span className="text-xs text-slate-500 font-bold">up to ₹{Number(maxDiscountCap)}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-medium">
                        Min. order: <strong className="text-slate-800">₹{Number(c.min_order_value || 0)}</strong> •{' '}
                        {c.payment_method_restriction || 'ALL'} Payments
                      </p>
                    </div>

                    {/* Usage Progress Bar */}
                    <div className="space-y-1.5 pt-3 border-t border-slate-100">
                      <div className="flex justify-between text-[11px] font-bold">
                        <span className="text-slate-500">Redemptions</span>
                        <span className="text-slate-800">
                          {used} / {usageLimit} ({percentUsed}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-600 to-amber-500 rounded-full"
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-emerald-800 font-bold pt-1">
                        Total savings granted: ₹{Number(c.total_discount_given || 0).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Button */}
                  <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{getValidityBadge(c.valid_to)}</span>
                    </div>
                    <button
                      onClick={() => toggleStatusMutation.mutate({ id: c.id, isActive: !c.is_active })}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${c.is_active
                          ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                    >
                      {c.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black uppercase tracking-wider">
                    <th className="py-3.5 px-5">Coupon Code</th>
                    <th className="py-3.5 px-4">Discount Value</th>
                    <th className="py-3.5 px-4">Min. Basket</th>
                    <th className="py-3.5 px-4">Redemptions</th>
                    <th className="py-3.5 px-4">Total Granted</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {coupons.map((c: any) => {
                    const discountType = c.discount_type || c.type || 'PERCENT';
                    const isPercent = discountType === 'PERCENT';
                    const discountValue = Number(c.discount_value ?? c.value ?? 0);
                    const maxDiscountCap = c.max_discount ?? c.max_discount_cap;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5">
                          <span className="font-mono font-black text-slate-900 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-md text-xs">
                            {c.code}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {isPercent
                            ? `${discountValue}% off ${maxDiscountCap ? `(Cap ₹${Number(maxDiscountCap)})` : ''}`
                            : `Flat ₹${discountValue} off`}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-600">₹{Number(c.min_order_value || 0)}</td>
                        <td className="py-3.5 px-4 font-black text-slate-900">{c.total_used} used</td>
                        <td className="py-3.5 px-4 font-black text-emerald-800">
                          ₹{Number(c.total_discount_given || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${c.is_active
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500'
                              }`}
                          >
                            {c.is_active ? 'ACTIVE' : 'DISABLED'}
                          </span>
                          <div className="text-[10px] text-slate-400 font-medium mt-1">
                            {getValidityBadge(c.valid_to)}
                          </div>
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            onClick={() => toggleStatusMutation.mutate({ id: c.id, isActive: !c.is_active })}
                            className={`px-3 py-1 rounded-xl text-xs font-bold ${c.is_active
                                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              }`}
                          >
                            {c.is_active ? 'Disable' : 'Enable'}
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
      </main>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl p-6 border border-slate-200">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-900">Create Promotional Coupon</h3>
                <p className="text-xs text-slate-500">Issue an instant promotional discount code</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
              className="space-y-4 text-xs"
            >
              <div>
                <label className="block font-black text-slate-700 mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MONSOON20 or CHAI100"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-black text-sm text-emerald-950 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Discount Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="PERCENT">PERCENTAGE (%)</option>
                    <option value="FLAT">FLAT AMOUNT (₹)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Value ({type === 'PERCENT' ? '%' : '₹'})
                  </label>
                  <input
                    type="number"
                    required
                    value={value}
                    onChange={(e) => setValue(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    value={maxDiscountCap}
                    onChange={(e) => setMaxDiscountCap(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Min. Order Value (₹)</label>
                  <input
                    type="number"
                    value={minOrderValue}
                    onChange={(e) => setMinOrderValue(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Claims Cap</label>
                  <input
                    type="number"
                    value={usageLimitTotal}
                    onChange={(e) => setUsageLimitTotal(Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Payment Method</label>
                  <select
                    value={paymentRestriction}
                    onChange={(e) => setPaymentRestriction(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  >
                    <option value="ALL">All Payments</option>
                    <option value="ONLINE">Prepaid Only (Razorpay)</option>
                    <option value="COD">COD Only</option>
                  </select>
                </div>
              </div>

              {/* First-Time User Only Checkbox */}
              <div className="p-3 bg-amber-50/70 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <label htmlFor="firstOrderCheck" className="text-xs font-black text-amber-950 block cursor-pointer">
                    First-Time Buyer Exclusivity
                  </label>
                  <p className="text-[10px] text-amber-800 font-medium">
                    Coupon can only be redeemed on a user's 1st order. Invalid on next orders for the same account.
                  </p>
                </div>
                <input
                  type="checkbox"
                  id="firstOrderCheck"
                  checked={isFirstOrderOnly}
                  onChange={(e) => setIsFirstOrderOnly(e.target.checked)}
                  className="w-4 h-4 text-emerald-800 rounded border-amber-300 focus:ring-emerald-700 cursor-pointer"
                />
              </div>

              {/* Days Selection / Validity Duration */}
              <div className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-black text-slate-800 flex items-center gap-1.5 text-xs">
                    <Calendar className="w-4 h-4 text-emerald-800" />
                    <span>Coupon Validity (Days) *</span>
                  </label>
                  <span className="text-[10.5px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/80">
                    Expires:{' '}
                    {new Date(Date.now() + (Number(validityDays) || 1) * 24 * 60 * 60 * 1000).toLocaleDateString(
                      'en-IN',
                      { day: 'numeric', month: 'short', year: 'numeric' }
                    )}
                  </span>
                </div>

                {/* Preset Chips */}
                <div className="grid grid-cols-6 gap-1.5">
                  {[
                    { label: '7D', days: 7 },
                    { label: '15D', days: 15 },
                    { label: '30D', days: 30 },
                    { label: '60D', days: 60 },
                    { label: '90D', days: 90 },
                    { label: '1 Yr', days: 365 },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setValidityDays(p.days)}
                      className={`py-1.5 text-[11px] font-black rounded-lg border transition-all ${validityDays === p.days
                          ? 'bg-emerald-800 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom Number Input */}
                <div className="relative">
                  <input
                    type="number"
                    min={1}
                    max={3650}
                    required
                    placeholder="Enter custom duration in days"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold pr-16 text-slate-900 focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    Days
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || !code}
                  className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black shadow-sm transition-all active:scale-95"
                >
                  {createMutation.isPending ? 'Publishing...' : 'Publish Voucher'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attractive Feedback Modal (Replaces browser alert) */}
      {feedback && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
            {feedback.type === 'success' ? (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-emerald-50/50">
                <Check className="w-8 h-8 text-emerald-700 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-700 border-2 border-rose-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-rose-50/50">
                <AlertCircle className="w-8 h-8 text-rose-600 stroke-[2.5]" />
              </div>
            )}

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {feedback.title}
            </h3>

            {feedback.code && feedback.type === 'success' && (
              <div className="my-3 py-2 px-3 bg-amber-50 border border-amber-200/80 rounded-xl inline-flex items-center gap-2">
                <Ticket className="w-4 h-4 text-amber-700" />
                <span className="font-mono font-black text-sm text-amber-900 tracking-wider">
                  {feedback.code}
                </span>
              </div>
            )}

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
