import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  EyeOff,
  Eye,
  Reply,
  Star,
  ShieldCheck,
  CheckCircle2,
  ThumbsUp,
  Sparkles,
  Coffee,
  X,
  Search,
} from 'lucide-react';
import { api } from '../services/api';
import { Header } from '../components/Header';
import { getTeaImage, getFlavourColor } from '../utils/teaAssets';

export const Reviews: React.FC = () => {
  const queryClient = useQueryClient();
  const [replyingId, setReplyingId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState('');
  const [search, setSearch] = useState('');
  const [starFilter, setStarFilter] = useState<number | null>(null);

  const { data: reviews, isLoading, refetch } = useQuery({
    queryKey: ['admin-reviews'],
    queryFn: async () => {
      const res = await api.get('/admin/reviews');
      return res.data?.data || [];
    },
  });

  const moderateMutation = useMutation({
    mutationFn: async ({
      id,
      isHidden,
      adminReply,
    }: {
      id: number;
      isHidden?: boolean;
      adminReply?: string;
    }) => {
      await api.patch(`/admin/reviews/${id}/moderate`, { isHidden, adminReply });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      setReplyingId(null);
      setReplyText('');
    },
  });

  const allReviews = reviews || [];
  const totalReviewsCount = allReviews.length;
  const avgRating = totalReviewsCount
    ? allReviews.reduce((sum: number, r: any) => sum + Number(r.rating || 5), 0) / totalReviewsCount
    : 5.0;

  const filteredReviews = allReviews.filter((rev: any) => {
    const matchesSearch =
      (rev.reviewer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (rev.product_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (rev.comment || '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (starFilter !== null && Number(rev.rating) !== starFilter) return false;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Buyer Reviews & Taste Notes Moderation"
        subtitle="Manage verified customer feedback, star ratings, and official estate sommelier replies"
        onRefresh={() => refetch()}
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* Rating Summary Banner */}
        <div className="bg-gradient-to-r from-[#04160E] via-[#0E3D29] to-[#145338] text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6 border border-emerald-800/40">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex flex-col items-center justify-center shadow-lg">
              <span className="text-3xl font-black text-amber-300">{avgRating.toFixed(1)}</span>
              <div className="flex text-amber-400 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-2.5 h-2.5 fill-current" />
                ))}
              </div>
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Verified Tasting Feedback</span>
              </div>
              <h2 className="text-xl font-black tracking-tight">Customer Satisfaction Index</h2>
              <p className="text-xs text-emerald-100/80 mt-0.5">
                Based on {totalReviewsCount} verified reviews from registered tea drinkers.
              </p>
            </div>
          </div>

          {/* Quick Filter Star Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setStarFilter(null)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${starFilter === null
                  ? 'bg-amber-400 text-emerald-950 shadow-xs'
                  : 'bg-white/10 text-emerald-100 hover:bg-white/20'
                }`}
            >
              All Stars
            </button>
            {[5, 4, 3, 2, 1].map((s) => (
              <button
                key={s}
                onClick={() => setStarFilter(starFilter === s ? null : s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${starFilter === s
                    ? 'bg-amber-400 text-emerald-950 shadow-xs'
                    : 'bg-white/10 text-emerald-100 hover:bg-white/20'
                  }`}
              >
                <span>{s}</span>
                <Star className="w-3 h-3 fill-current" />
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-card-subtle flex items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
            <input
              type="text"
              placeholder="Search reviewer, blend, comment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:bg-white focus:outline-none"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            {filteredReviews.length} reviews matching
          </span>
        </div>

        {/* Reviews List */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
          {isLoading ? (
            <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
              <p className="text-xs font-bold text-slate-500">Loading reviews...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="p-16 text-center text-slate-400 space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-600">No reviews found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredReviews.map((rev: any) => {
                const img = getTeaImage(rev.product_name);
                const colour = getFlavourColor(rev.product_name);

                return (
                  <div
                    key={rev.id}
                    className={`p-6 transition-colors space-y-3.5 ${rev.is_hidden ? 'bg-slate-50/80 opacity-70' : 'hover:bg-slate-50/50'
                      }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5">
                        {/* Reviewer Avatar */}
                        <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 font-black text-sm flex items-center justify-center flex-shrink-0 shadow-xs border border-emerald-200">
                          {rev.reviewer_name ? rev.reviewer_name.charAt(0).toUpperCase() : 'R'}
                        </div>

                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-sm text-slate-900">{rev.reviewer_name}</span>
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-bold">
                              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Verified Buyer
                            </span>
                            <span className="text-[11px] text-slate-400">({rev.reviewer_email})</span>
                          </div>

                          {/* Tea Blend Hallmark */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-5 h-5 rounded-md bg-white border border-slate-200 p-0.5 flex-shrink-0">
                              <img src={img} alt={rev.product_name} className="w-full h-full object-contain" />
                            </div>
                            <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md border ${colour.bg} ${colour.text} ${colour.border}`}>
                              {rev.product_name}
                            </span>
                          </div>

                          {/* Stars & Date */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex text-amber-500">
                              {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                                <Star key={i} className="w-3.5 h-3.5 fill-current" />
                              ))}
                            </div>
                            {rev.title && <span className="font-black text-xs text-slate-800">{rev.title}</span>}
                            <span className="text-[11px] text-slate-400">
                              • {new Date(rev.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Moderation Controls */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <button
                          onClick={() => moderateMutation.mutate({ id: rev.id, isHidden: !rev.is_hidden })}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${rev.is_hidden
                              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                            }`}
                        >
                          {rev.is_hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          <span>{rev.is_hidden ? 'Hidden (Unhide)' : 'Hide Review'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setReplyingId(rev.id);
                            setReplyText(rev.admin_reply || '');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-800 text-white hover:bg-emerald-700 rounded-xl text-xs font-black shadow-xs transition-all active:scale-95"
                        >
                          <Reply className="w-3.5 h-3.5" />
                          <span>Reply</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed pl-13">{rev.comment}</p>

                    {/* Official Brand Reply */}
                    {rev.admin_reply && (
                      <div className="ml-13 bg-gradient-to-r from-emerald-50 to-emerald-50/40 border-l-4 border-emerald-700 p-3.5 rounded-r-2xl text-xs space-y-1">
                        <p className="font-black text-emerald-900 flex items-center gap-1.5 text-[11px]">
                          <Coffee className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Vardhamrit Estate Official Response:</span>
                        </p>
                        <p className="text-slate-800 leading-relaxed font-medium">{rev.admin_reply}</p>
                      </div>
                    )}

                    {/* Reply Box */}
                    {replyingId === rev.id && (
                      <div className="ml-13 mt-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <label className="block text-xs font-bold text-slate-700">Official Brand Response</label>
                        <textarea
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Thank the customer or provide tea tasting & brewing recommendations..."
                          className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-700 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setReplyingId(null)}
                            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => moderateMutation.mutate({ id: rev.id, adminReply: replyText })}
                            className="px-4 py-1.5 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs"
                          >
                            Post Official Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
