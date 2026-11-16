import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Lock, Mail, AlertCircle, ArrowRight, Coffee, Sparkles } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('admin@vardhamrit.com');
  const [password, setPassword] = useState('Admin@123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) return;

    try {
      setLoading(true);
      setError(null);

      const res = await api.post('/auth/login', {
        identifier,
        password,
        expectedRole: 'admin',
      });

      const { user, accessToken } = res.data.data;
      if (user.role !== 'admin') {
        setError('Access denied: Customer accounts cannot access the operational admin portal.');
        return;
      }

      login(accessToken, user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid admin credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAdmin = () => {
    setIdentifier('admin@vardhamrit.com');
    setPassword('Admin@123');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#062316] via-[#082F1E] to-[#04180F] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl p-8 border border-white/20 relative z-10">
        {/* Brand Crest */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-amber-900/20">
            <Coffee className="w-8 h-8 text-emerald-950" />
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-2xl font-black tracking-wider text-slate-900">VARDHAMRIT</h1>
            <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full">
              ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase mt-1">
            Tea Operations & Inventory Console
          </p>
        </div>

        {error && (
          <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 px-4 py-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Admin Email or Phone
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@vardhamrit.com"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all text-slate-900 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
              Secret Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all text-slate-900 font-medium"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-[#082F1E] to-[#105634] hover:from-[#062316] hover:to-[#082F1E] text-white font-bold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 disabled:opacity-70 mt-2"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                <span>Authenticating with MySQL...</span>
              </span>
            ) : (
              <>
                <span>Sign In to Operations Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fillDemoAdmin}
            className="w-full bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <span>Reset Demo Master Credentials</span>
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center space-y-1">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1 font-medium">
            <Sparkles className="w-3 h-3 text-amber-500" /> Connected to Database: <code className="text-slate-600 font-bold">vardhamrit</code>
          </p>
          <p className="text-[10px] text-slate-400">
            Secure 256-bit JWT Session • Role-Based Admin Guard
          </p>
        </div>
      </div>
    </div>
  );
};
