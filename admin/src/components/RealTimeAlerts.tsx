import React, { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Bell, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '../services/api';

interface AlertNotification {
  id: string;
  orderId: number;
  total: number;
  paymentMethod: string;
  time: string;
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

export const RealTimeAlerts: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertNotification[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket: Socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('⚡ Connected to Admin Real-Time Events Socket');
    });

    socket.on('order.created', (data: any) => {
      playOrderChime();
      const newAlert: AlertNotification = {
        id: `${data.orderId || data.id}-${Date.now()}`,
        orderId: data.orderId || data.id,
        total: data.total,
        paymentMethod: data.paymentMethod || 'COD',
        time: new Date().toLocaleTimeString(),
      };
      setAlerts((prev) => [newAlert, ...prev.slice(0, 4)]);

      // Invalidate queries so admin UI updates without refresh
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
    });

    socket.on('order.status_updated', () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-single-order'] });
      queryClient.invalidateQueries({ queryKey: ['admin-dashboard'] });
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
    <div className="fixed top-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="bg-white border-l-4 border-chai-700 shadow-xl rounded-lg p-4 flex items-start justify-between animate-bounce"
        >
          <div className="flex items-start gap-3">
            <div className="bg-chai-100 p-2 rounded-full text-chai-700 mt-0.5">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">
                New Order Received!
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Order <span className="font-semibold text-chai-700">#{alert.orderId}</span> for ₹{Number(alert.total).toFixed(2)} via {alert.paymentMethod}
              </p>
              <span className="text-[10px] text-gray-400 mt-1 block">{alert.time}</span>
            </div>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
