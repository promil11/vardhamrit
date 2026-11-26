import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { Bell, BellRing, X, ArrowRight } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL, SOCKET_URL } from '../services/api';

interface AlertNotification {
  id: string;
  type: 'ORDER' | 'STOCK_ALERT';
  time: string;
  // Order specifics
  orderId?: number;
  total?: number;
  paymentMethod?: string;
  // Stock alert specifics
  productName?: string;
  variantLabel?: string;
  customerName?: string;
  contactValue?: string;
}

// Web Audio API synthesizer for instant bell chime
function playOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Dual-tone chime (notes: E5 -> B5)
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(659.25, now, 0.4);       // E5
    playTone(987.77, now + 0.15, 0.6); // B5
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

// Pleasant ascending triple-tone chime for restock alert requests
function playStockAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.22, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    playTone(523.25, now, 0.25);        // C5
    playTone(659.25, now + 0.12, 0.28); // E5
    playTone(783.99, now + 0.24, 0.45); // G5
  } catch (e) {
    console.warn('Audio chime error:', e);
  }
}

export const RealTimeAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket: Socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Admin Real-Time Events Socket');
    });

    // 1. New Order Placed Alert
    socket.on('order.created', (data: any) => {
      playOrderChime();
      const newAlert: AlertNotification = {
        id: `order-${data.orderId || data.id}-${Date.now()}`,
        type: 'ORDER',
        orderId: data.orderId || data.id,
        total: data.total,
        paymentMethod: data.paymentMethod || 'COD',
        time: new Date().toLocaleTimeString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 4)]);

      // Invalidate queries so admin UI updates without refresh
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-metrics'] });
    });

    // 2. New Out-of-Stock Alert Requested by customer
    socket.on('stock_alert.created', (data: any) => {
      playStockAlertChime();
      const newAlert: AlertNotification = {
        id: `stock-${data.id || Date.now()}-${Math.random()}`,
        type: 'STOCK_ALERT',
        productName: data.productName || 'Tea Blend',
        variantLabel: data.variantLabel || '',
        customerName: data.customerName || data.userName || 'Customer',
        contactValue: data.contactValue || '',
        time: new Date().toLocaleTimeString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 4)]);

      // Instantly update badge count on sidebar and stock tables without refresh
      queryClient.setQueryData(['admin-sidebar-stock-alerts-count'], (old: number = 0) => old + 1);
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-stock-alerts-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    });

    socket.on('stock_alert.removed', () => {
      queryClient.setQueryData(['admin-sidebar-stock-alerts-count'], (old: number = 1) => Math.max(0, old - 1));
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-stock-alerts-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-metrics'] });
    });

    socket.on('stock_alert.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-stock-alerts-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-metrics'] });
    });

    socket.on('stock_alert.notified', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-stock-alerts-count'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stock-subscriptions'] });
    });

    socket.on('order.status_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sidebar-metrics'] });
    });

    socket.on('catalog.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    });

    socket.on('coupons.updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-coupons'] });
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto bg-white border border-slate-200/90 shadow-2xl rounded-2xl p-4 transition-all animate-in slide-in-from-top-3 duration-200 hover:shadow-card-elevated"
        >
          {alert.type === 'STOCK_ALERT' ? (
            <div className="flex items-start justify-between gap-3">
              <Link
                to="/stock-alerts"
                onClick={() => dismiss(alert.id)}
                className="flex items-start gap-3 flex-1 group"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                  <BellRing className="w-5 h-5 animate-pulse text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-slate-900 tracking-tight">
                      Out of Stock Alert Requested!
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded border border-amber-200">
                      NEW
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">
                    <strong className="text-slate-900 font-bold">{alert.customerName}</strong> requested restock notification for{' '}
                    <span className="font-extrabold text-amber-900">{alert.productName}</span>
                    {alert.variantLabel ? ` (${alert.variantLabel})` : ''}.
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                    <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                      Open Stock Alerts <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="text-slate-400 font-medium">{alert.time}</span>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(alert.id);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <Link
                to="/orders"
                onClick={() => dismiss(alert.id)}
                className="flex items-start gap-3 flex-1 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5 animate-pulse text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-black text-slate-900 tracking-tight">
                      New Order Received!
                    </p>
                    <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded border border-emerald-200">
                      ORDER
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-snug">
                    Order <strong className="font-black text-emerald-800">#{alert.orderId}</strong> for{' '}
                    <span className="font-extrabold text-slate-900">₹{Number(alert.total).toFixed(2)}</span> via {alert.paymentMethod}.
                  </p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[10px]">
                    <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                      Process Order <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                    </span>
                    <span className="text-slate-400 font-medium">{alert.time}</span>
                  </div>
                </div>
              </Link>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(alert.id);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
                title="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
