import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Package, Heart, Bell, Clock, Search, ArrowRight } from 'lucide-react';

const SalesDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentlyUpdated, setRecentlyUpdated] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/sales');
      setStats(response.data.stats);
      setRecentlyUpdated(response.data.recentlyUpdated);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Sales Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium">Quick access to latest pricing</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <button
          onClick={() => navigate('/products')}
          className="glass-panel p-6 text-left hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group rounded-2xl animate-slide-up"
          style={{ animationDelay: '0s' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Browse Products</p>
              <p className="text-xl font-display font-bold text-slate-900 dark:text-white mt-1">View Price List</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 shadow-lg shadow-primary-500/20 group-hover:scale-110 transition-transform">
              <Search className="w-5 h-5 text-white" />
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/products')}
          className="glass-panel p-6 text-left hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group rounded-2xl animate-slide-up"
          style={{ animationDelay: '0.1s' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Recently Updated</p>
              <p className="text-xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {stats?.recentlyUpdatedCount || 0} Products
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
              <Clock className="w-5 h-5 text-white" />
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/products')}
          className="glass-panel p-6 text-left hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group rounded-2xl animate-slide-up"
          style={{ animationDelay: '0.2s' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Favorites</p>
              <p className="text-xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {stats?.favoriteCount || 0} Items
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-lg shadow-rose-500/20 group-hover:scale-110 transition-transform">
              <Heart className="w-5 h-5 text-white" />
            </div>
          </div>
        </button>

        <button
          onClick={() => navigate('/products')}
          className="glass-panel p-6 text-left hover:-translate-y-1 hover:shadow-xl transition-all duration-300 group rounded-2xl animate-slide-up"
          style={{ animationDelay: '0.3s' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Notifications</p>
              <p className="text-xl font-display font-bold text-slate-900 dark:text-white mt-1">
                {stats?.unreadNotifications || 0} Unread
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/20 group-hover:scale-110 transition-transform">
              <Bell className="w-5 h-5 text-white" />
            </div>
          </div>
        </button>
      </div>

      {/* Recently Updated Products */}
      <div className="glass-panel rounded-2xl animate-slide-up overflow-hidden" style={{ animationDelay: '0.4s' }}>
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-primary-50 dark:bg-primary-500/10 rounded-md">
              <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">Recently Updated Products</h2>
          </div>
          <button
            onClick={() => navigate('/products')}
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Item Code</th>
                <th className="table-header">Product Description</th>
                <th className="table-header">Brand</th>
                <th className="table-header">Product Group</th>
                <th className="table-header">MOP</th>
                <th className="table-header">Updated</th>
              </tr>
            </thead>
            <tbody>
              {recentlyUpdated.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-8 text-gray-500">
                    No recent updates
                  </td>
                </tr>
              ) : (
                recentlyUpdated.map((product) => (
                  <tr 
                    key={product.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => navigate('/products')}
                  >
                    <td className="table-cell font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{product.product_id}</td>
                    <td className="table-cell font-medium text-gray-900 dark:text-white max-w-xs">
                      <span className="truncate block" title={product.name}>{product.name}</span>
                    </td>
                    <td className="table-cell">{product.brand_name || '—'}</td>
                    <td className="table-cell">{product.category_name}</td>
                    <td className="table-cell font-semibold text-gray-900 dark:text-white">
                      {product.dealer_price > 0 ? `₹${parseFloat(product.dealer_price).toLocaleString('en-IN', {maximumFractionDigits:2})}` : '—'}
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">
                      {new Date(product.last_updated).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesDashboard;
