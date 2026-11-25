import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingBag,
  PackageCheck,
  TicketPercent,
  MessageSquareText,
  Users,
  LogOut,
  Coffee,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Radio,
  Bell,
  BellRing,
  Flame,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

export const Sidebar: React.FC = () => {
  const { logout, admin } = useAuth();

  // Fetch quick metrics for badges in sidebar
  const { data: dashboardData } = useQuery({
    queryKey: ['admin-sidebar-metrics'],
    queryFn: async () => {
      const res = await api.get('/admin/dashboard');
      return res.data?.data;
    },
    refetchInterval: 30000,
  });

  const { data: pendingAlertsCount } = useQuery({
    queryKey: ['admin-sidebar-stock-alerts-count'],
    queryFn: async () => {
      const res = await api.get('/admin/stock-subscriptions?status=pending');
      return res.data?.data?.stats?.pending ?? 0;
    },
    refetchInterval: 30000,
  });

  const pendingOrders = Number(
    dashboardData?.orderCounts?.PLACED ||
    dashboardData?.orderCounts?.CONFIRMED ||
    0
  );
  const lowStockCount = Number(dashboardData?.lowStockAlerts?.length || 0);
  const stockAlertsCount = Number(pendingAlertsCount || 0);

  const navItems = [
    { to: '/', label: 'Overview & Analytics', icon: LayoutDashboard, badge: null },
    {
      to: '/orders',
      label: 'Orders & Fulfillment',
      icon: ShoppingBag,
      badge: pendingOrders > 0 ? { text: `${pendingOrders}`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' } : null,
    },
    {
      to: '/products',
      label: 'Tea Catalog & Stock',
      icon: PackageCheck,
      badge: lowStockCount > 0 ? { text: `! ${lowStockCount}`, color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' } : null,
    },
    {
      to: '/stock-alerts',
      label: 'Out of Stock Alerts',
      icon: BellRing,
      badge: stockAlertsCount > 0 ? { text: `${stockAlertsCount} Wait`, color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' } : null,
    },
    { to: '/coupons', label: 'Coupons & Promos', icon: TicketPercent, badge: null },
    {
      to: '/deals',
      label: 'Deal of the Day',
      icon: Flame,
      badge: { text: 'HOT', color: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
    },
    {
      to: '/notifications',
      label: 'Push & Marketing',
      icon: Bell,
      badge: null,
    },
    { to: '/reviews', label: 'Buyer Reviews', icon: MessageSquareText, badge: null },
    { to: '/customers', label: 'Customer LTV', icon: Users, badge: null },
  ];

  return (
    <aside className="w-64 glass-sidebar text-white flex flex-col min-h-screen border-r border-emerald-950/80 shadow-2xl select-none relative z-30">
      {/* Brand Hallmark */}
      <div className="p-5 border-b border-emerald-900/40 bg-gradient-to-r from-emerald-950/60 to-transparent">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-950/50 border border-amber-300/40">
              <Coffee className="w-5 h-5 text-emerald-950" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-emerald-950 flex items-center justify-center">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-black tracking-wider text-white">VARDHAMRIT</h1>
              <span className="text-[9px] font-black bg-gradient-to-r from-amber-400/20 to-amber-500/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 rounded shadow-xs">
                PRO
              </span>
            </div>
            <p className="text-[10.5px] text-emerald-300/80 font-medium">Estate Operations Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold tracking-wider text-emerald-400/70 uppercase flex items-center justify-between">
          <span>Operations Suite</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/40" />
        </div>

        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${isActive
                ? 'bg-gradient-to-r from-emerald-500/25 via-emerald-500/15 to-transparent text-emerald-200 border border-emerald-500/40 shadow-sm shadow-emerald-950/30'
                : 'text-slate-300/90 hover:bg-white/[0.06] hover:text-white border border-transparent'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={`w-4 h-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-300'
                    }`}
                />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border ${item.badge.color}`}
                  >
                    {item.badge.text}
                  </span>
                )}
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                )}
              </>
            )}
          </NavLink>
        ))}

        <div className="pt-4 px-3 pb-1 text-[10px] font-extrabold tracking-wider text-emerald-400/70 uppercase">
          Live Storefront
        </div>
        <a
          href="http://localhost:8081"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-slate-300 hover:bg-white/[0.06] hover:text-white border border-emerald-900/30 transition-all duration-150"
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover:rotate-12 transition-transform" />
            <span className="font-medium">Customer App</span>
          </span>
          <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-slate-300" />
        </a>

        {/* Live Socket Status Chip */}
        <div className="mx-2 mt-4 p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-900/40 text-[11px] text-emerald-300/90 flex items-center gap-2">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <div className="flex-1">
            <p className="font-bold text-[10.5px] leading-tight text-emerald-200">Real-Time Sync</p>
            <p className="text-[9.5px] text-emerald-400/60 leading-tight">Socket.IO Connected</p>
          </div>
        </div>
      </nav>

      {/* Admin User & Sign Out Footer */}
      <div className="p-3.5 border-t border-emerald-900/50 bg-black/30 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3 px-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-700 to-emerald-900 text-emerald-200 border border-emerald-500/40 font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm">
              {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{admin?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3 h-3 text-emerald-400" />
                Estate Super Lead
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-2 px-3 text-xs font-bold text-rose-300 hover:text-rose-100 hover:bg-rose-950/50 border border-rose-900/40 rounded-xl transition-all shadow-xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
