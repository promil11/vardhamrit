import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  Truck,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
  ArrowRight,
  Box,
  TicketPercent,
  Layers,
  Flame,
  Coffee,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';
import { getTeaImage, getFlavourColor } from '../utils/teaAssets';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [chartView, setChartView] = useState<'7days' | '14days' | '30days'>('7days');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['admin-dashboard', chartView],
    queryFn: async () => {
      const rangeParam = chartView === '30days' ? '30d' : chartView === '14days' ? '14d' : '7d';
      const res = await api.get('/admin/dashboard', {
        params: { range: rangeParam },
      });
      return res.data?.data;
    },
    refetchInterval: 15000,
  });

  if (isLoading || !data) {
    return (
      <div className="flex-1 flex flex-col bg-slate-50 min-h-screen">
        <Header title="Estate Operations & Sales Dashboard" subtitle="Loading live metrics..." />
        <div className="p-16 flex flex-col items-center justify-center flex-1 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-100/80 text-emerald-800 flex items-center justify-center animate-spin border border-emerald-200">
            <Package className="w-7 h-7" />
          </div>
          <p className="text-sm font-bold text-slate-700 animate-pulse">
            Connecting to Upper Assam Estate Database...
          </p>
        </div>
      </div>
    );
  }

  const sales = data.sales || {};
  const orderCounts = data.orderCounts || {};
  const revenueChart = (data.revenueChart || []).map((pt: any) => {
    let displayDate = pt.date;
    if (typeof pt.date === 'string' && pt.date.includes('-')) {
      const [year, month, day] = pt.date.split('-').map(Number);
      if (year && month && day) {
        displayDate = new Date(year, month - 1, day).toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
        });
      }
    }
    return {
      ...pt,
      displayDate,
      revenue: Number(pt.revenue || 0),
      order_count: Number(pt.order_count || 0),
    };
  });
  const topProducts = data.topProducts || [];
  const lowStock = data.lowStockAlerts || [];

  const confirmedCount = Number(orderCounts.CONFIRMED || orderCounts.PLACED || orderCounts.APPROVED || 0);
  const dispatchedCount = Number(orderCounts.DISPATCHED || 0);
  const deliveredCount = Number(orderCounts.DELIVERED || 0);
  const cancelledCount = Number(orderCounts.CANCELLED || 0);
  const totalPipeline = confirmedCount + dispatchedCount + deliveredCount + cancelledCount;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Estate Operations & Sales Dashboard"
        subtitle="Live dynamic metrics queried from MySQL vardhamrit database"
        onRefresh={() => refetch()}
      />

      <main className="p-6 md:p-8 space-y-8 max-w-8xl w-full mx-auto">
        {/* Top Operational Status Banner */}
        <div className="relative rounded-3xl p-6 md:p-8 text-white shadow-xl overflow-hidden bg-gradient-to-r from-[#04160E] via-[#0E3D29] to-[#145338] border border-emerald-800/40">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 rounded-full mb-3 backdrop-blur-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                  ESTATE DISPATCH CLUSTER ACTIVE • UPPER ASSAM
                </span>
              </div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                Vardhamrit Chai Enterprise Hub
              </h1>
              <p className="text-xs md:text-sm text-emerald-100/80 mt-1.5 leading-relaxed">
                Direct-from-garden single origin chai operations with real-time packaging verification, courier fulfillment, and instant Razorpay settlement tracking.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 relative z-10 flex-shrink-0">
              <button
                onClick={() => navigate('/orders')}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-emerald-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-950/20 active:scale-95"
              >
                <ShoppingBag className="w-4 h-4 text-emerald-950" />
                <span>Manage Orders</span>
              </button>
              <button
                onClick={() => navigate('/products')}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white border border-white/20 rounded-xl text-xs font-bold transition-all flex items-center gap-2 backdrop-blur-xs active:scale-95"
              >
                <Box className="w-4 h-4 text-emerald-300" />
                <span>Tea Catalog</span>
              </button>
            </div>
          </div>

          {/* Decorative Background Elements */}
          <div className="absolute -right-12 -bottom-16 w-64 h-64 bg-emerald-400/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/2 -top-12 w-48 h-48 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* 1. Four Core Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Today's Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-card-elevated hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Today's Intake</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-black text-sm">
                ₹
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{Number(sales.today_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-emerald-200/60">
                  <ArrowUpRight className="w-3 h-3 text-emerald-600" /> Live
                </span>
                <span className="text-[11px] text-slate-400">Verified net orders</span>
              </div>
            </div>
          </div>

          {/* Card 2: 7-Day Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-card-elevated hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Past 7 Days</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{Number(sales.weekly_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-amber-200/60">
                  Weekly Run
                </span>
                <span className="text-[11px] text-slate-400">Rolling 7 days</span>
              </div>
            </div>
          </div>

          {/* Card 3: 30-Day Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-card-elevated hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Past 30 Days</span>
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 border border-teal-200 flex items-center justify-center">
                <Package className="w-4 h-4 text-teal-600" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{Number(sales.monthly_sales || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-teal-200/60">
                  Monthly Total
                </span>
                <span className="text-[11px] text-slate-400">Active cycle</span>
              </div>
            </div>
          </div>

          {/* Card 4: Total Lifetime Revenue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] hover:shadow-card-elevated hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">Lifetime Volume</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 border border-purple-200 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-purple-600" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                ₹{Number(sales.total_revenue || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10.5px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md flex items-center gap-1 border border-purple-200/60">
                  Gross All-Time
                </span>
                <span className="text-[11px] text-slate-400">All shipments</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Order Fulfillment Radar (Clickable Status Rail) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-card-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-700" />
                <span>Fulfillment Pipeline by Status</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time queue across fulfillment lifecycle. Click any card to filter orders immediately.
              </p>
            </div>
            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              {totalPipeline} Total In Pipeline
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            {/* Confirmed / Placed */}
            <div
              onClick={() => navigate('/orders?status=CONFIRMED')}
              className="group p-4 bg-amber-50/70 hover:bg-amber-100/70 border border-amber-200/80 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
            >
              <div className="flex items-center justify-between text-amber-800 mb-2">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600 group-hover:rotate-12 transition-transform" />
                  <span className="text-xs font-black">CONFIRMED</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-amber-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-2xl font-black text-amber-950">{confirmedCount}</p>
              <p className="text-[10.5px] text-amber-700 font-medium mt-1">Ready for packing</p>
            </div>

            {/* Dispatched */}
            <div
              onClick={() => navigate('/orders?status=DISPATCHED')}
              className="group p-4 bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200/80 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
            >
              <div className="flex items-center justify-between text-blue-800 mb-2">
                <div className="flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600 group-hover:translate-x-1 transition-transform" />
                  <span className="text-xs font-black">DISPATCHED</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-blue-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-2xl font-black text-blue-950">{dispatchedCount}</p>
              <p className="text-[10.5px] text-blue-700 font-medium mt-1">In transit via riders</p>
            </div>

            {/* Delivered */}
            <div
              onClick={() => navigate('/orders?status=DELIVERED')}
              className="group p-4 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
            >
              <div className="flex items-center justify-between text-emerald-800 mb-2">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-black">DELIVERED</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-emerald-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-2xl font-black text-emerald-950">{deliveredCount}</p>
              <p className="text-[10.5px] text-emerald-700 font-medium mt-1">Fulfilled successfully</p>
            </div>

            {/* Cancelled */}
            <div
              onClick={() => navigate('/orders?status=CANCELLED')}
              className="group p-4 bg-rose-50/70 hover:bg-rose-100/70 border border-rose-200/80 rounded-2xl cursor-pointer transition-all hover:shadow-sm"
            >
              <div className="flex items-center justify-between text-rose-800 mb-2">
                <div className="flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-600 group-hover:-rotate-45 transition-transform" />
                  <span className="text-xs font-black">CANCELLED</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-rose-500 group-hover:translate-x-1 transition-transform" />
              </div>
              <p className="text-2xl font-black text-rose-950">{cancelledCount}</p>
              <p className="text-[10.5px] text-rose-700 font-medium mt-1">Restocked & refunded</p>
            </div>
          </div>
        </div>

        {/* 3. Revenue Trend Chart & Top Sellers Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart (2 cols) */}
          <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-card-subtle flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-700" />
                    <span>Daily Revenue Trajectory</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Order value over the last {chartView === '30days' ? '30' : chartView === '14days' ? '14' : '7'} calendar days.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 shadow-xs">
                    {[
                      { id: '7days', label: '7 Days' },
                      { id: '14days', label: '14 Days' },
                      { id: '30days', label: '30 Days' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setChartView(tab.id as any)}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all ${chartView === tab.id
                          ? 'bg-emerald-950 text-amber-300 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                          }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full hidden sm:inline-block">
                    Live Telemetry
                  </span>
                </div>
              </div>

              <div className="h-72 w-full">
                {revenueChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="emeraldGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0E3D29" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#0E3D29" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                      <XAxis
                        dataKey="displayDate"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 700 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const p = payload[0].payload;
                            return (
                              <div className="bg-slate-950 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-800 text-xs space-y-1">
                                <p className="font-bold text-slate-300">{p.displayDate}</p>
                                <p className="text-lg font-black text-emerald-400">
                                  ₹{p.revenue.toLocaleString('en-IN')}
                                </p>
                                <p className="text-[11px] text-slate-400">{p.order_count} chai orders completed</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#0E3D29"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#emeraldGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    No revenue data recorded in the selected window.
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-700" />
                <span>Verified Direct Harvest Sales</span>
              </span>
              <span className="font-bold text-slate-700">Auto-refreshed every 15s</span>
            </div>
          </div>

          {/* Top Selling Blends (1 col) with Real Packaging Images */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-card-subtle flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-amber-500" />
                  <span>Top Selling Blends</span>
                </h3>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  By Units
                </span>
              </div>

              <div className="space-y-3.5">
                {topProducts.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400">
                    <Coffee className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <span>No tea sales recorded yet.</span>
                  </div>
                ) : (
                  topProducts.slice(0, 4).map((item: any, idx: number) => {
                    const maxSold = Math.max(...topProducts.map((p: any) => Number(p.total_units_sold || 1)));
                    const percent = Math.min(100, Math.round((Number(item.total_units_sold) / maxSold) * 100));
                    const imgUrl = getTeaImage(item.product_name);
                    const color = getFlavourColor(item.product_name);

                    return (
                      <div
                        key={idx}
                        className="p-2.5 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/70 transition-all flex items-center gap-3"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200/60 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={imgUrl}
                            alt={item.product_name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-bold text-slate-900 truncate pr-2">
                              {item.product_name}
                            </span>
                            <span className="font-black text-emerald-800 whitespace-nowrap">
                              ₹{Number(item.total_revenue || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-amber-500 rounded-full"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="text-[10px] font-extrabold text-slate-500 whitespace-nowrap">
                              {item.total_units_sold} pk
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <button
              onClick={() => navigate('/products')}
              className="mt-4 w-full py-2.5 bg-slate-50 hover:bg-emerald-50/80 border border-slate-200/80 hover:border-emerald-300 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-800 transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <span>Inspect Full Tea Catalog</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
