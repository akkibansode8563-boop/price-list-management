import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api, { downloadFile } from '../utils/api';
import toast from 'react-hot-toast';
import {
  Search, Filter, Download, Upload, Plus, Edit2, Trash2, Heart,
  X, ChevronLeft, ChevronRight, FileSpreadsheet, Eye, Star
} from 'lucide-react';

const Products = () => {
  const { user, hasRole } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    itemCode: '',
    brand: '',
    category: '',
    stockStatus: '',
    minPrice: '',
    maxPrice: ''
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0
  });
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [pricingProduct, setPricingProduct] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(searchQuery && { search: searchQuery }),
        ...(filters.brand && { brand: filters.brand }),
        ...(filters.category && { category: filters.category }),
        ...(filters.stockStatus && { stockStatus: filters.stockStatus }),
        ...(filters.minPrice && { minPrice: filters.minPrice }),
        ...(filters.maxPrice && { maxPrice: filters.maxPrice }),
        ...(filters.itemCode && { itemCode: filters.itemCode })
      });

      const response = await api.get(`/products?${params}`);
      setProducts(response.data.products);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery, filters]);

  const fetchFilters = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get('/categories'),
        api.get('/categories/brands/all')
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
    } catch (error) {
      console.error('Failed to load filters:', error);
    }
  };

  useEffect(() => {
    fetchFilters();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timeout);
  }, [fetchProducts]);

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ itemCode: '', brand: '', category: '', stockStatus: '', minPrice: '', maxPrice: '' });
    setSearchQuery('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const toggleFavorite = async (productId) => {
    try {
      const response = await api.post(`/products/${productId}/favorite`);
      setProducts(prev => prev.map(p => 
        p.id === productId ? { ...p, is_favorite: response.data.isFavorite } : p
      ));
      toast.success(response.data.message);
    } catch (error) {
      toast.error('Failed to update favorite');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${productId}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch (error) {
      toast.error('Failed to delete product');
    }
  };

  const handleExport = async () => {
    try {
      await downloadFile('/export', 'price_list.xlsx');
      toast.success('Price list downloaded');
    } catch (error) {
      toast.error('Failed to export');
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const response = await api.post('/upload/products', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success(`Upload complete: ${response.data.results.created} created, ${response.data.results.updated} updated`);
      setShowUploadModal(false);
      setUploadFile(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Upload failed');
    }
  };

  const downloadTemplate = async () => {
    try {
      await downloadFile('/upload/template', 'product_template.xlsx');
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Failed to download template');
    }
  };
  // ── PM: update only MOP price
  const updateMopPrice = async (productId, newPrice) => {
    try {
      await api.put(`/products/${productId}`, { dealerPrice: newPrice });
      toast.success('MOP price updated successfully');
      setShowPriceModal(false);
      setPricingProduct(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed');
    }
  };

  // ── PM MOP Price Modal
  const MopPriceModal = () => {
    const [newPrice, setNewPrice] = useState(
      pricingProduct?.dealer_price ? String(pricingProduct.dealer_price) : ''
    );
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!newPrice || isNaN(newPrice) || parseFloat(newPrice) < 0) {
        toast.error('Please enter a valid price');
        return;
      }
      setSubmitting(true);
      await updateMopPrice(pricingProduct.id, parseFloat(newPrice));
      setSubmitting(false);
    };

    const currentMop = parseFloat(pricingProduct?.dealer_price || 0);
    const newMop     = parseFloat(newPrice || 0);
    const diff       = newMop - currentMop;
    const diffPct    = currentMop > 0 ? ((diff / currentMop) * 100).toFixed(1) : 0;

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
        <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-slide-up relative">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <Edit2 className="w-4 h-4 text-primary-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit MOP Price</h2>
                <p className="text-xs text-gray-400 mt-0.5">Market Operating Price</p>
              </div>
            </div>
            <button
              onClick={() => { setShowPriceModal(false); setPricingProduct(null); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Product Info */}
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Product</p>
              <p className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">
                {pricingProduct?.name}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {pricingProduct?.product_id} &nbsp;·&nbsp; {pricingProduct?.category_name}
              </p>
            </div>

            {/* Current → New */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Current MOP
                </label>
                <div className="input-field bg-gray-50 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 cursor-not-allowed">
                  ₹{currentMop.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  New MOP <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                  value={newPrice}
                  onChange={e => setNewPrice(e.target.value)}
                  className="input-field"
                  placeholder="Enter new price"
                />
              </div>
            </div>

            {/* Change indicator */}
            {newPrice && newMop !== currentMop && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                diff > 0
                  ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                  : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
              }`}>
                <span className="font-bold text-lg">{diff > 0 ? '↑' : '↓'}</span>
                <span>
                  {diff > 0 ? '+' : ''}₹{Math.abs(diff).toLocaleString('en-IN', { maximumFractionDigits: 2 })}&nbsp;
                  ({diff > 0 ? '+' : ''}{diffPct}%)
                </span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => { setShowPriceModal(false); setPricingProduct(null); }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !newPrice}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : null}
                Update MOP
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const ProductModal = () => {
    const [formData, setFormData] = useState(editingProduct || {
      productId: '', brandId: '', categoryId: '', name: '', modelNumber: '',
      specification: '', dealerPrice: '',
      stockStatus: 'In Stock', availableQuantity: '', gstPercent: 18, remarks: ''
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (editingProduct) {
          await api.put(`/products/${editingProduct.id}`, formData);
          toast.success('Product updated');
        } else {
          await api.post('/products', formData);
          toast.success('Product created');
        }
        setShowModal(false);
        setEditingProduct(null);
        fetchProducts();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Operation failed');
      }
    };

    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
        <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-slide-up">
          <div className="sticky top-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingProduct ? 'Edit Product' : 'Add New Product'}
            </h2>
            <button onClick={() => { setShowModal(false); setEditingProduct(null); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product ID *</label>
                <input type="text" required value={formData.productId} onChange={e => setFormData({...formData, productId: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Brand</label>
                <select value={formData.brandId} onChange={e => setFormData({...formData, brandId: e.target.value})} className="input-field">
                  <option value="">Select Brand</option>
                  {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category *</label>
                <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="input-field">
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Model Number</label>
                <input type="text" value={formData.modelNumber} onChange={e => setFormData({...formData, modelNumber: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">MOP (Market Operating Price) *</label>
                <input type="number" step="0.01" required value={formData.dealerPrice} onChange={e => setFormData({...formData, dealerPrice: e.target.value})} className="input-field" placeholder="e.g. 48000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST %</label>
                <input type="number" step="0.01" value={formData.gstPercent} onChange={e => setFormData({...formData, gstPercent: e.target.value})} className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Specification</label>
                <textarea value={formData.specification} onChange={e => setFormData({...formData, specification: e.target.value})} className="input-field" rows="2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Remarks</label>
                <textarea value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} className="input-field" rows="2" />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => { setShowModal(false); setEditingProduct(null); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">
                {editingProduct ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Products</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            {pagination.totalCount.toLocaleString()} products found
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasRole('sales_manager') && (
            <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Export
            </button>
          )}
          {hasRole('super_admin', 'product_manager') && (
            <>
              <button onClick={() => setShowUploadModal(true)} className="btn-secondary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Bulk Upload
              </button>
              <button onClick={() => { setEditingProduct(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="glass-panel p-5 rounded-2xl animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, brand, model..."
              value={searchQuery}
              onChange={handleSearch}
              className="input-field pl-10"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-gray-100' : ''}`}
          >
            <Filter className="w-4 h-4" /> Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <input type="text" placeholder="Item Code" value={filters.itemCode} onChange={e => handleFilterChange('itemCode', e.target.value)} className="input-field" />
            <select value={filters.brand} onChange={e => handleFilterChange('brand', e.target.value)} className="input-field">
              <option value="">All Brands</option>
              {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <select value={filters.category} onChange={e => handleFilterChange('category', e.target.value)} className="input-field">
              <option value="">All Categories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" placeholder="Min Price" value={filters.minPrice} onChange={e => handleFilterChange('minPrice', e.target.value)} className="input-field" />
            <input type="number" placeholder="Max Price" value={filters.maxPrice} onChange={e => handleFilterChange('maxPrice', e.target.value)} className="input-field" />
          </div>
        )}

        {(searchQuery || Object.values(filters).some(v => v)) && (
          <button onClick={clearFilters} className="mt-3 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Clear all filters
          </button>
        )}
      </div>

      {/* Products Table */}
      <div className="glass-panel rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: '0.2s' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {hasRole('sales_manager') && <th className="table-header w-10"></th>}
                <th className="table-header">Item Code</th>
                <th className="table-header">Product Description</th>
                <th className="table-header">Brand</th>
                <th className="table-header">Product Group</th>
                <th className="table-header">MOP</th>
                <th className="table-header">Last Updated</th>
                {hasRole('super_admin', 'product_manager') && <th className="table-header">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={hasRole('sales_manager') ? 7 : 6} className="table-cell text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={hasRole('sales_manager') ? 7 : 6} className="table-cell text-center py-12 text-gray-500">
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {hasRole('sales_manager') && (
                      <td className="table-cell">
                        <button onClick={() => toggleFavorite(product.id)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                          <Heart className={`w-4 h-4 ${product.is_favorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
                        </button>
                      </td>
                    )}
                    <td className="table-cell font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{product.product_id}</td>
                    <td className="table-cell">
                      <p className="font-medium text-gray-900 dark:text-white max-w-xs truncate" title={product.name}>{product.name}</p>
                    </td>
                    <td className="table-cell">{product.brand_name || '—'}</td>
                    <td className="table-cell">{product.category_name}</td>
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">
                      {product.dealer_price > 0 ? `₹${parseFloat(product.dealer_price).toLocaleString('en-IN', {maximumFractionDigits:2})}` : '—'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-xs">
                      {new Date(product.last_updated).toLocaleDateString()}
                    </td>
                    {/* Actions */}
                    {hasRole('super_admin') && (
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setEditingProduct(product); setShowModal(true); }}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-primary-600"
                            title="Edit product"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
                            title="Delete product"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                    {hasRole('product_manager') && (
                      <td className="table-cell">
                        <button
                          onClick={() => { setPricingProduct(product); setShowPriceModal(true); }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
                          title="Edit MOP price"
                        >
                          <Edit2 className="w-3 h-3" />
                          Edit MOP
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {/* Admin: full product modal */}
      {showModal && hasRole('super_admin') && <ProductModal />}

      {/* PM: MOP price edit modal */}
      {showPriceModal && hasRole('product_manager') && <MopPriceModal />}

      {showUploadModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="glass-panel rounded-3xl shadow-2xl w-full max-w-md p-8 animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Bulk Upload</h2>
              <button onClick={() => setShowUploadModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center">
                <FileSpreadsheet className="w-10 h-10 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {uploadFile ? uploadFile.name : 'Drop Excel/CSV file here or click to browse'}
                </p>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={e => setUploadFile(e.target.files[0])}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="btn-secondary cursor-pointer inline-block">
                  Choose File
                </label>
              </div>
              <button onClick={downloadTemplate} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
                <Download className="w-3 h-3" /> Download template
              </button>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowUploadModal(false)} className="btn-secondary">Cancel</button>
                <button onClick={handleUpload} className="btn-primary">Upload</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
