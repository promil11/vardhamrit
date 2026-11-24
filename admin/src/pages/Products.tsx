import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Edit2,
  Trash2,
  X,
  Package,
  Star,
  Search,
  LayoutGrid,
  List,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  ArrowUpRight,
  SlidersHorizontal,
  Flame,
} from 'lucide-react';
import { api, API_BASE_URL } from '../services/api';
import { Header } from '../components/Header';
import { getTeaImage, getFlavourColor } from '../utils/teaAssets';

export const Products: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('filter') || 'ALL');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f) {
      setCategoryFilter(f);
    }
  }, [searchParams]);

  // Helper to reliably read stock from either stock_quantity or stock
  const getVariantStock = (v: any): number => {
    if (!v) return 0;
    return Number(v.stock_quantity ?? v.stock ?? 0);
  };

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [variants, setVariants] = useState<
    Array<{ id?: number; label: string; price: number; mrp: number; stock: number; sku: string }>
  >([
    { label: '200 g', price: 129, mrp: 160, stock: 100, sku: '' },
    { label: '400 g', price: 239, mrp: 299, stock: 80, sku: '' },
    { label: '500 g', price: 279, mrp: 349, stock: 60, sku: '' },
    { label: '1 kg Saver', price: 519, mrp: 649, stock: 40, sku: '' },
  ]);

  const { data: products, isLoading } = useQuery({
    queryKey: ['admin-products'],
    queryFn: async () => {
      const res = await api.get('/products?limit=100&includeInactive=true');
      return res.data?.data?.items || [];
    },
  });

  const openCreate = () => {
    setEditingProduct(null);
    setName('');
    setDescription('Born in the Valleys of Assam, Brewed for Your Soul. 100% pure garden-fresh tea.');
    setImageUrl('/uploads/products/classic_200g.png');
    setIsActive(true);
    setVariants([
      { label: '200 g', price: 129, mrp: 160, stock: 100, sku: `TEA-${Date.now()}-200G` },
      { label: '400 g', price: 239, mrp: 299, stock: 80, sku: `TEA-${Date.now()}-400G` },
      { label: '500 g', price: 279, mrp: 349, stock: 60, sku: `TEA-${Date.now()}-500G` },
      { label: '1 kg Saver', price: 519, mrp: 649, stock: 40, sku: `TEA-${Date.now()}-1KG` },
    ]);
    setModalOpen(true);
  };

  const openEdit = (p: any) => {
    setEditingProduct(p);
    setName(p.name);
    setDescription(p.description || '');
    setImageUrl(p.image_url || p.imageUrl || '');
    setIsActive(p.is_active !== undefined ? Boolean(Number(p.is_active) === 1 || p.is_active === true) : true);
    setVariants(
      p.variants?.map((v: any) => {
        const vPrice = Number(v.price) || 0;
        const vMrp = v.mrp !== undefined && v.mrp !== null && Number(v.mrp) > 0 ? Number(v.mrp) : vPrice;
        return {
          id: v.id,
          label: v.label,
          price: vPrice,
          mrp: vMrp,
          stock: getVariantStock(v),
          sku: v.sku,
        };
      }) || []
    );
    setModalOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingProduct) {
        await api.put(`/admin/products/${editingProduct.id}`, {
          name,
          description,
          imageUrl,
          isActive,
          variants,
        });
      } else {
        await api.post('/admin/products', {
          name,
          description,
          imageUrl,
          variants,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setModalOpen(false);
      setFeedback({
        type: 'success',
        title: editingProduct ? 'Product Updated' : 'Product Created',
        message: `${name || 'Product'} has been saved successfully.`,
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Error Saving Product',
        message: err.response?.data?.error || err.message || 'Failed to save product details.',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setFeedback({
        type: 'success',
        title: 'Product Deleted',
        message: 'The tea product and its variants have been removed.',
      });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        title: 'Error Deleting Product',
        message: err.response?.data?.error || err.message || 'Failed to delete product.',
      });
    },
  });

  const updateVariant = (index: number, field: string, val: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  // Preset packaging image options
  const packagingPresets = [
    { label: 'Classic / Normal', path: '/uploads/products/classic_200g.png', preview: '/images/tea/classic_200g.png' },
    { label: 'Kadak Masala', path: '/uploads/products/masala_200g.png', preview: '/images/tea/masala_200g.png' },
    { label: 'Shahi Kesar', path: '/uploads/products/kesar_200g.png', preview: '/images/tea/kesar_200g.png' },
    { label: 'Royal Chocolate', path: '/uploads/products/chocolate_200g.png', preview: '/images/tea/chocolate_200g.png' },
  ];

  // Count of low stock products (any variant <= 15)
  const lowStockCount = (products || []).filter((p: any) =>
    p.variants?.some((v: any) => getVariantStock(v) <= 15)
  ).length;

  // Filtering products
  const filteredProducts = (products || []).filter((p: any) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (categoryFilter === 'ALL') return true;
    if (categoryFilter === 'CLASSIC') return p.name?.toLowerCase().includes('classic') || p.name?.toLowerCase().includes('normal') || p.name?.toLowerCase().includes('assam');
    if (categoryFilter === 'MASALA') return p.name?.toLowerCase().includes('masala') || p.name?.toLowerCase().includes('kadak');
    if (categoryFilter === 'KESAR') return p.name?.toLowerCase().includes('kesar') || p.name?.toLowerCase().includes('saffron');
    if (categoryFilter === 'CHOCOLATE') return p.name?.toLowerCase().includes('chocolate');
    if (categoryFilter === 'LOW_STOCK') {
      return p.variants?.some((v: any) => getVariantStock(v) <= 15);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-slate-50/80 min-h-screen">
      <Header
        title="Tea Catalog & Warehouse Stock"
        subtitle="Manage single-origin blends, packaging weights (200g, 400g, 500g, 1kg), and inventory"
        actions={
          <button
            onClick={openCreate}
            className="bg-emerald-800 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Blend</span>
          </button>
        }
      />

      <main className="p-6 md:p-8 max-w-8xl w-full mx-auto space-y-6">
        {/* Controls & Category Filter Bar */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-card-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Blends' },
              { id: 'CLASSIC', label: 'Classic / Normal' },
              { id: 'MASALA', label: 'Kadak Masala' },
              { id: 'KESAR', label: 'Shahi Kesar' },
              { id: 'CHOCOLATE', label: 'Royal Chocolate' },
              {
                id: 'LOW_STOCK',
                label: `⚠️ Low Stock (${lowStockCount})`,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${categoryFilter === tab.id
                  ? 'bg-emerald-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & View Switcher */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search blend, packaging..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:bg-white transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/80">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'table'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
                  }`}
                title="Table view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Product Cards Grid or Table */}
        {isLoading ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/90 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading catalog from MySQL database...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200/90 space-y-3">
            <Package className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-600">No tea blends found matching criteria.</p>
            <button
              onClick={() => {
                setSearch('');
                setCategoryFilter('ALL');
              }}
              className="text-xs font-bold text-emerald-700 hover:underline"
            >
              Reset filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          /* Grid View Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredProducts.map((p: any) => {
              const imgUrl = getTeaImage(p.image_url || p.imageUrl || p.name);
              const colour = getFlavourColor(p.name);
              const minPrice = p.variants?.length
                ? Math.min(...p.variants.map((v: any) => Number(v.price)))
                : 0;
              const maxPrice = p.variants?.length
                ? Math.max(...p.variants.map((v: any) => Number(v.price)))
                : 0;
              const totalStock = p.variants?.reduce((sum: number, v: any) => sum + getVariantStock(v), 0) || 0;
              const hasLowStock = p.variants?.some((v: any) => getVariantStock(v) <= 15);

              return (
                <div
                  key={p.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  {/* Top Image & Flavour Hallmark */}
                  <div className="p-4 bg-gradient-to-b from-slate-50/90 via-slate-50/40 to-transparent relative flex flex-col items-center border-b border-slate-100/80">
                    <div className="w-full flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider shadow-2xs ${colour.badge}`}>
                        ESTATE BLEND
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[10px] font-black px-2.5 py-1 rounded-full border shadow-2xs ${p.is_active
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${p.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                        />
                        {p.is_active ? 'ACTIVE' : 'DRAFT'}
                      </span>
                    </div>

                    <div className="w-36 h-36 my-2 relative flex items-center justify-center">
                      <img
                        src={imgUrl}
                        alt={p.name}
                        className="max-h-32 w-auto object-contain filter group-hover:scale-105 transition-transform duration-300 drop-shadow-md"
                      />
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50/90 px-2.5 py-0.5 rounded-full border border-amber-200/70 shadow-2xs">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      <span>{Number(p.avg_rating || 4.9).toFixed(1)}</span>
                      <span className="text-slate-400 font-medium">({p.review_count || 128})</span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <h4 className="font-black text-slate-900 text-base leading-snug group-hover:text-emerald-800 transition-colors line-clamp-1" title={p.name}>
                        {p.name}
                      </h4>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed min-h-[34px]">
                        {p.description || 'Single-origin Upper Assam harvest with robust kadak aroma and authentic malty liquor.'}
                      </p>
                    </div>

                    {/* Pack Overview: Price Range & Overall Stock */}
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Price Range
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black text-slate-900">₹{minPrice}</span>
                          {maxPrice > minPrice && (
                            <span className="text-xs text-slate-500 font-bold"> - ₹{maxPrice}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          Total Stock
                        </span>
                        <span
                          className={`inline-flex items-center text-[11px] font-black px-2 py-0.5 rounded-md border ${hasLowStock
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                        >
                          {totalStock} units
                        </span>
                      </div>
                    </div>

                    {/* Pack Sizes & Pricing Table */}
                    <div className="bg-slate-50/90 rounded-2xl border border-slate-200/80 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                        <span>Pack Variant</span>
                        <span>Price & Stock</span>
                      </div>

                      <div className="space-y-1.5">
                        {p.variants?.map((v: any) => {
                          const stockCount = getVariantStock(v);
                          const price = Number(v.price) || 0;
                          const mrp = v.mrp !== undefined && v.mrp !== null && Number(v.mrp) > 0 ? Number(v.mrp) : price;
                          const discountPct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
                          const isLow = stockCount <= 15;

                          return (
                            <div
                              key={v.id}
                              className="flex items-center justify-between bg-white rounded-xl px-2.5 py-1.5 border border-slate-200/60 shadow-2xs hover:border-emerald-300 transition-colors"
                            >
                              {/* Variant Name */}
                              <div className="flex items-center gap-1.5 min-w-0 pr-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                <span className="font-bold text-slate-800 text-[11px] truncate max-w-[105px]" title={v.label}>
                                  {v.label}
                                </span>
                              </div>

                              {/* Price, Discount & Stock */}
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex items-baseline gap-1 text-right">
                                  <span className="font-black text-slate-900 text-xs">₹{price}</span>
                                  {mrp > price && (
                                    <span className="text-[10px] text-slate-400 line-through font-medium">₹{mrp}</span>
                                  )}
                                </div>

                                {discountPct > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-black text-[9px] shrink-0">
                                    {discountPct}% OFF
                                  </span>
                                )}

                                <span
                                  className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-md shrink-0 ${isLow
                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600'
                                    }`}
                                  title={`${stockCount} units available`}
                                >
                                  {stockCount}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="flex-1 py-2.5 bg-slate-900 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-md flex items-center justify-center gap-1.5 group/btn"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-slate-300 group-hover/btn:text-white transition-colors" />
                        <span>Edit Blend</span>
                      </button>
                      <button
                        onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                        className="p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200/80 hover:border-rose-200 transition-all"
                        title="Delete product"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Table View Mode */
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-card-subtle overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-5">Tea Blend & Packaging</th>
                    <th className="py-3.5 px-4">Rating</th>
                    <th className="py-3.5 px-4">Available Pack Variants</th>
                    <th className="py-3.5 px-4">Total Stock</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p: any) => {
                    const imgUrl = getTeaImage(p.image_url || p.imageUrl || p.name);
                    const totalStock = p.variants?.reduce((sum: number, v: any) => sum + getVariantStock(v), 0) || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5 flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                            <img src={imgUrl} alt={p.name} className="w-full h-full object-contain" />
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">{p.name}</p>
                            <p className="text-slate-400 text-[11px] line-clamp-1 max-w-sm">
                              {p.description}
                            </p>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 font-bold text-amber-600">
                            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                            <span>{Number(p.avg_rating || 4.9).toFixed(1)}</span>
                          </span>
                          <span className="text-slate-400 ml-1 text-[11px]">({p.review_count || 128})</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.variants?.map((v: any) => {
                              const stockCount = getVariantStock(v);
                              return (
                                <span
                                  key={v.id}
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${stockCount <= 15
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                    }`}
                                >
                                  {v.label}: ₹{v.price} ({stockCount})
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-black text-slate-800">
                          {totalStock} units
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-black ${p.is_active
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                              }`}
                          >
                            {p.is_active ? 'ACTIVE' : 'DRAFT'}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-right space-x-2">
                          <button
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit blend"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ id: p.id, name: p.name })}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors"
                            title="Delete blend"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Product Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-[#04160E] to-[#0E3D29] text-white flex justify-between items-center">
              <div>
                <h3 className="font-black text-base">
                  {editingProduct ? 'Edit Tea Blend' : 'Add New Chai Blend'}
                </h3>
                <p className="text-xs text-emerald-300/80">Configure authentic flavours, packaging & grams</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Basic Blend Details */}
              <div className="space-y-3">
                <h4 className="font-black uppercase text-slate-700 tracking-wider text-[11px]">
                  1. Blend Identity & Tagline
                </h4>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Blend Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Vardhamrit Kadak Masala Chai"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-700 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Estate Story & Description</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Born in the Valleys of Assam, Brewed for Your Soul..."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-700 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Packaging Preset Selector */}
              <div className="space-y-3">
                <h4 className="font-black uppercase text-slate-700 tracking-wider text-[11px]">
                  2. Authentic Packaging Pouch Image
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {packagingPresets.map((preset) => (
                    <button
                      key={preset.path}
                      type="button"
                      onClick={() => setImageUrl(preset.path)}
                      className={`p-2.5 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${imageUrl === preset.path
                        ? 'border-emerald-600 bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                        }`}
                    >
                      <div className="w-12 h-12 flex items-center justify-center">
                        <img src={preset.preview} alt={preset.label} className="w-full h-full object-contain" />
                      </div>
                      <span className="font-bold text-[10.5px] text-slate-800">{preset.label}</span>
                    </button>
                  ))}
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Or Direct Asset URL / Path</label>
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-mono text-[11px]"
                  />
                </div>
              </div>

              {/* Pack Sizes & Weights */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black uppercase text-slate-700 tracking-wider text-[11px]">
                    3. Pack Sizes & Pricing (Grams)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((prev) => [
                        ...prev,
                        { label: '250 g', price: 150, mrp: 199, stock: 50, sku: `TEA-${Date.now()}` },
                      ])
                    }
                    className="text-emerald-800 font-extrabold text-[11px] hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Size
                  </button>
                </div>

                <div className="space-y-3">
                  {variants.map((v, idx) => {
                    const price = Number(v.price) || 0;
                    const mrp = v.mrp !== undefined && v.mrp !== null && Number(v.mrp) > 0 ? Number(v.mrp) : price;
                    const savings = Math.max(0, mrp - price);
                    const discountPct = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;

                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 space-y-2.5 hover:border-emerald-300 transition-colors"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex-1 min-w-[110px]">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Size Label</label>
                            <input
                              type="text"
                              value={v.label}
                              onChange={(e) => updateVariant(idx, 'label', e.target.value)}
                              placeholder="e.g. 200 g"
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                            />
                          </div>

                          <div className="w-24">
                            <label className="block text-[10px] text-slate-800 font-black mb-0.5">Selling Price (₹)</label>
                            <input
                              type="number"
                              min="1"
                              value={v.price}
                              onChange={(e) => {
                                const newPrice = Number(e.target.value);
                                updateVariant(idx, 'price', newPrice);
                                if (v.mrp && v.mrp < newPrice) {
                                  updateVariant(idx, 'mrp', Math.round(newPrice * 1.25));
                                }
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-900"
                            />
                          </div>

                          <div className="w-24">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">MRP / Strikethrough (₹)</label>
                            <input
                              type="number"
                              min={price}
                              value={v.mrp ?? ''}
                              placeholder="MRP"
                              onChange={(e) => {
                                const newMrp = Number(e.target.value);
                                updateVariant(idx, 'mrp', newMrp);
                              }}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-600 line-through"
                            />
                          </div>

                          <div className="w-24">
                            <label className="block text-[10px] text-rose-600 font-black mb-0.5 flex items-center gap-0.5">
                              <Flame className="w-2.5 h-2.5" /> % OFF
                            </label>
                            <div className="relative">
                              <input
                                type="number"
                                min="0"
                                max="90"
                                value={discountPct > 0 ? discountPct : ''}
                                placeholder="0"
                                onChange={(e) => {
                                  const pct = Number(e.target.value);
                                  if (pct >= 0 && pct < 100 && price > 0) {
                                    const calculatedMrp = pct > 0 ? Math.round(price / (1 - pct / 100)) : price;
                                    updateVariant(idx, 'mrp', calculatedMrp);
                                  }
                                }}
                                className="w-full p-2 bg-rose-50 border border-rose-200 rounded-xl font-black text-xs text-rose-700 pr-5"
                              />
                              <span className="absolute right-2 top-2 text-[10px] font-black text-rose-500">%</span>
                            </div>
                          </div>

                          <div className="w-20">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">Stock</label>
                            <input
                              type="number"
                              value={v.stock}
                              onChange={(e) => updateVariant(idx, 'stock', Number(e.target.value))}
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-xs"
                            />
                          </div>

                          <div className="flex-1 min-w-[90px]">
                            <label className="block text-[10px] text-slate-500 font-bold mb-0.5">SKU</label>
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => updateVariant(idx, 'sku', e.target.value)}
                              placeholder="SKU"
                              className="w-full p-2 bg-white border border-slate-200 rounded-xl text-[10px] font-mono"
                            />
                          </div>

                          {variants.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setVariants((prev) => prev.filter((_, i) => i !== idx))}
                              className="p-2 mt-4 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors"
                              title="Delete variant"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Live Quick Discount Buttons & Preview Pill */}
                        <div className="flex items-center justify-between text-[11px] pt-1 px-0.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-slate-400">Quick %:</span>
                            {[0, 10, 15, 20, 25, 30, 40].map((pct) => (
                              <button
                                key={pct}
                                type="button"
                                onClick={() => {
                                  const calculatedMrp = pct > 0 ? Math.round(price / (1 - pct / 100)) : price;
                                  updateVariant(idx, 'mrp', calculatedMrp);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-black transition-colors ${discountPct === pct
                                  ? pct === 0
                                    ? 'bg-slate-700 text-white shadow-xs'
                                    : 'bg-rose-600 text-white shadow-xs'
                                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200'
                                  }`}
                              >
                                {pct === 0 ? '0% (None)' : `${pct}%`}
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center gap-2">
                            {discountPct > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-black text-[10px] shadow-xs">
                                <Flame className="w-2.5 h-2.5" />
                                {discountPct}% OFF (Customer saves ₹{savings})
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">No discount (MRP = Selling Price)</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900">Publish in Customer App</p>
                  <p className="text-[11px] text-slate-500">Enable this blend for immediate ordering on storefront.</p>
                </div>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-5 h-5 accent-emerald-700 rounded cursor-pointer"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-xl font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || !name}
                onClick={() => saveMutation.mutate()}
                className="px-5 py-2 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black shadow-sm transition-all"
              >
                {saveMutation.isPending ? 'Saving to Database...' : editingProduct ? 'Update Tea Blend' : 'Create Tea Blend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attractive Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-600 border-2 border-rose-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-rose-50/50">
              <Trash2 className="w-8 h-8 text-rose-600 stroke-[2.2]" />
            </div>

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              Delete Tea Blend?
            </h3>

            <p className="text-xs text-slate-600 font-medium leading-relaxed mt-2 mb-2 px-2">
              Are you sure you want to permanently delete <strong className="text-slate-900 font-bold">"{deleteConfirm.name}"</strong>?
            </p>
            <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200/70 rounded-xl p-2.5 font-bold mb-6">
              ⚠️ This will remove the blend, all packaging sizes, inventory stock, and catalog listings. This action cannot be undone.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="py-2.5 px-4 border border-slate-200 rounded-xl font-bold text-xs text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  const id = deleteConfirm.id;
                  setDeleteConfirm(null);
                  deleteMutation.mutate(id);
                }}
                className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-sm transition-all active:scale-95"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Attractive Feedback Modal */}
      {feedback && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-100">
            {feedback.type === 'success' ? (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-emerald-50/50">
                <CheckCircle2 className="w-8 h-8 text-emerald-700 stroke-[2.5]" />
              </div>
            ) : (
              <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-50 text-rose-700 border-2 border-rose-200/80 flex items-center justify-center mb-4 shadow-sm ring-8 ring-rose-50/50">
                <AlertTriangle className="w-8 h-8 text-rose-600 stroke-[2.5]" />
              </div>
            )}

            <h3 className="text-lg font-black text-slate-900 tracking-tight">
              {feedback.title}
            </h3>

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
