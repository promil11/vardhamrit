import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  Sparkles,
  Award,
  Crown,
  Search,
  ArrowUpRight,
  CreditCard,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';

export const Customers: React.FC = () => {
  const [search, setSearch] = useState('');

  const { data: customers, isLoading, refetch } = useQuery({
    queryKey: ['admin-customers'],
    queryFn: async () => {
      const res = await api.get('/admin/customers');
      return res.data?.data || [];
    },
  });

  const allCustomers = customers || [];
  const totalCustomers = allCustomers.length;
  const totalSpend = allCustomers.reduce((acc: number, c: any) => acc + Number(c.total_spent || 0), 0);
  const avgLTV = totalCustomers ? totalSpend / totalCustomers : 0;
  const repeatCustomers = allCustomers.filter((c: any) => Number(c.total_orders || 0) > 1).length;

  const getTier = (spend: number) => {
    if (spend >= 1000) {
      return {
        label: 'Gold Connoisseur',
        bg: 'bg-gradient-to-r from-amber-400/20 to-amber-500/20 text-amber-800 border-amber-400/40',
        icon: Crown,
      };
    }
    if (spend >= 400) {
      return {
        label: 'Silver Connoisseur',
        bg: 'bg-slate-100 text-slate-800 border-slate-300',
        icon: Award,
      };
    }
    return {
      label: 'Bronze Connoisseur',
      bg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      icon: Sparkles,
    };
  };

  const filtered = allCustomers.filter((c: any) => {
    const q = search.toLowerCase();
    return (
      (c.name || '').toLowerCase().includes(q) ||
      (c.email || '').toLowerCase().includes(q) ||
      (c.phone || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Customer Accounts & Lifetime Value (LTV)"
        subtitle="Analyze loyal tea connoisseurs, average basket value, and lifetime repeat volume"
        onRefresh={() => refetch()}
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Registered Drinkers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{totalCustomers}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">Direct store accounts</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center">
              <Users className="w-5 h-5 text-emerald-700" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Average Customer LTV</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                ₹{avgLTV.toFixed(0)}
              </h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">Average lifetime spend</p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-amber-700" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Repeat Buyers</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">{repeatCustomers}</h3>
              <p className="text-[11px] text-purple-700 font-semibold mt-1">
                {totalCustomers ? Math.round((repeatCustomers / totalCustomers) * 100) : 0}% retention rate
              </p>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-800 border border-purple-200 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-purple-700" />
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search by name, email or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">{filtered.length} customers</span>
        </div>

        {/* Customers Table */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading customers...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600">No customers found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-black uppercase tracking-wider">
                    <th className="py-3.5 px-5">Customer Profile</th>
                    <th className="py-3.5 px-4">Contact Information</th>
                    <th className="py-3.5 px-4">Connoisseur Tier</th>
                    <th className="py-3.5 px-4">Total Orders</th>
                    <th className="py-3.5 px-4 font-black">Lifetime Spend (LTV)</th>
                    <th className="py-3.5 px-5 text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c: any) => {
                    const tier = getTier(Number(c.total_spent || 0));
                    const TierIcon = tier.icon;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#08281B] to-[#145338] text-white font-black flex items-center justify-center text-xs flex-shrink-0 shadow-xs">
                            {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm">{c.name || 'Anonymous Drinker'}</p>
                            <p className="text-slate-400 text-[10px] font-mono">UID #{c.id}</p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 space-y-0.5">
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Mail className="w-3.5 h-3.5 text-slate-400" />
                              <span>{c.email}</span>
                            </div>
                          )}
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{c.phone}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${tier.bg}`}
                          >
                            <TierIcon className="w-3 h-3" />
                            <span>{tier.label}</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {c.total_orders} order{c.total_orders === 1 ? '' : 's'}
                        </td>
                        <td className="py-3.5 px-4 font-black text-emerald-800 text-sm">
                          ₹{Number(c.total_spent || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-5 text-right text-slate-500 font-medium">
                          {new Date(c.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
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
    </div>
  );
};
