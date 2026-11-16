import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Database, ShieldCheck, Clock, RefreshCw, Bell, Search, Sparkles } from 'lucide-react';

export const Header: React.FC<{
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  actions?: React.ReactNode;
}> = ({ title, subtitle, onRefresh, actions }) => {
  const { admin } = useAuth();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        })
      );
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 glass-panel border-b border-slate-200/90 px-6 md:px-8 flex items-center justify-between shadow-[0_1px_4px_0_rgba(0,0,0,0.03)] sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-black tracking-tight text-slate-900">{title}</h2>
          </div>
          {subtitle ? (
            <p className="text-[11px] text-slate-500 font-medium -mt-0.5">{subtitle}</p>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {/* Custom Actions if provided */}
        {actions}

        {/* Live Database Sync Indicator */}
        <div className="hidden sm:flex items-center gap-2 bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 px-3 py-1 rounded-full text-[11px] font-bold shadow-xs">
          <Database className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span>MySQL Live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500" />
        </div>

        {/* Digital Clock */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-600 font-semibold bg-slate-100/80 border border-slate-200 px-3 py-1 rounded-full">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{time} IST</span>
        </div>

        {/* Refresh Button */}
        {onRefresh ? (
          <button
            onClick={onRefresh}
            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-xl transition-all duration-150 shadow-xs"
            title="Refresh live metrics"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        ) : null}

        {/* Admin Avatar Chip */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#08281B] to-[#145338] text-white flex items-center justify-center font-black text-xs shadow-sm border border-emerald-800/40">
            {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="hidden sm:block text-right">
            <p className="text-xs font-bold text-slate-900 leading-tight">{admin?.name || 'Admin'}</p>
            <p className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 justify-end">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified
            </p>
          </div>
        </div>
      </div>
    </header>
  );
};
