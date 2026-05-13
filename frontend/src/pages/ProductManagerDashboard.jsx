import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  Package, Tag, TrendingUp, AlertTriangle,
  CheckCircle, XCircle, BarChart2, Star,
  ArrowRight, IndianRupee, Layers
} from 'lucide-react';

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const StatCard = ({ title, value, sub, icon: Icon, gradient, delay }) => (
  <div className="glass-panel p-6 rounded-2xl flex items-start gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-slide-up" style={{ animationDelay: delay }}>
    <div className={`p-3.5 rounded-2xl flex-shrink-0 bg-gradient-to-br ${gradient} shadow-lg`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">{title}</p>
      <p className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">{value}</p>
      {sub && <p className="text-xs font-medium text-slate-400 dark:text-slate-500 mt-1.5">{sub}</p>}
    </div>
  </div>
);

const ProductManagerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async () => {
    try {
      const res = await api.get('/dashboard/product-manager');
      setStats(res.data.stats);
      setCategoryBreakdown(res.data.categoryBreakdown || []);
      setTopProducts(res.data.topProducts || []);
      setRecentUpdates(res.data.recentUpdates || []);
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  const pricedPct = stats?.totalProducts > 0
    ? Math.round((stats.pricedProducts / stats.totalProducts) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">
            Welcome, {user?.firstName} 👋
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
            Your product portfolio — all prices in NLC (Net Landed Cost) / MOP
          </p>
        </div>
        <Link to="/products" className="btn-primary flex items-center gap-2">
          <Package className="w-4 h-4" />
          View My Products
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Products"
          value={fmt(stats?.totalProducts)}
          sub={`${pricedPct}% have NLC price`}
          icon={Package}
          gradient="from-blue-500 to-blue-600 shadow-blue-500/20"
          delay="0s"
        />
        <StatCard
          title="Product Groups"
          value={fmt(stats?.categoryCount)}
          sub="Assigned categories"
          icon={Layers}
          gradient="from-purple-500 to-indigo-600 shadow-purple-500/20"
          delay="0.1s"
        />
        <StatCard
          title="In Stock"
          value={fmt(stats?.inStock)}
          sub={`${fmt(stats?.outOfStock)} out of stock`}
          icon={CheckCircle}
          gradient="from-emerald-400 to-emerald-600 shadow-emerald-500/20"
          delay="0.2s"
        />
        <StatCard
          title="Pending Updates"
          value={fmt(stats?.pendingUpdates)}
          sub="Not updated in 30+ days"
          icon={AlertTriangle}
          gradient={stats?.pendingUpdates > 100 ? 'from-rose-500 to-rose-600 shadow-rose-500/20' : 'from-amber-400 to-orange-500 shadow-amber-500/20'}
          delay="0.3s"
        />
      </div>

      {/* MOP Price Range Banner */}
      <div className="glass-panel p-6 rounded-2xl animate-slide-up bg-gradient-to-r from-primary-50/50 to-indigo-50/50 dark:from-primary-900/10 dark:to-indigo-900/10" style={{ animationDelay: '0.4s' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-1.5 bg-primary-100 dark:bg-primary-900/50 rounded-md">
            <IndianRupee className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="font-display font-bold text-slate-900 dark:text-white text-base">MOP Price Range Across Your Portfolio</h2>
        </div>
        <div className="grid grid-cols-3 gap-6 text-center">
          <div className="bg-emerald-50/80 dark:bg-emerald-900/20 rounded-xl p-4 backdrop-blur-sm border border-emerald-100 dark:border-emerald-800/50">
            <p className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70 uppercase tracking-wide">Minimum MOP</p>
            <p className="text-2xl font-display font-bold text-emerald-700 dark:text-emerald-400 mt-1.5">₹{fmt(stats?.minNlc)}</p>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-900/20 rounded-xl p-4 backdrop-blur-sm border border-blue-100 dark:border-blue-800/50">
            <p className="text-xs font-semibold text-blue-600/70 dark:text-blue-400/70 uppercase tracking-wide">Average MOP</p>
            <p className="text-2xl font-display font-bold text-blue-700 dark:text-blue-400 mt-1.5">₹{fmt(stats?.avgNlc)}</p>
          </div>
          <div className="bg-purple-50/80 dark:bg-purple-900/20 rounded-xl p-4 backdrop-blur-sm border border-purple-100 dark:border-purple-800/50">
            <p className="text-xs font-semibold text-purple-600/70 dark:text-purple-400/70 uppercase tracking-wide">Maximum MOP</p>
            <p className="text-2xl font-display font-bold text-purple-700 dark:text-purple-400 mt-1.5">₹{fmt(stats?.maxNlc)}</p>
          </div>
        </div>
      </div>

      {/* Category Breakdown + Top Products side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Category Breakdown */}
        <div className="glass-panel rounded-2xl animate-slide-up overflow-hidden" style={{ animationDelay: '0.5s' }}>
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2.5 bg-white/50 dark:bg-slate-800/50">
            <div className="p-1.5 bg-primary-50 dark:bg-primary-500/10 rounded-md">
              <BarChart2 className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="font-display font-bold text-slate-900 dark:text-white">Top Product Groups</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {categoryBreakdown.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No data</p>
            ) : categoryBreakdown.map((cat, i) => {
              const maxCount = categoryBreakdown[0]?.product_count || 1;
              const pct = Math.round((cat.product_count / maxCount) * 100);
              return (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-[55%]">
                      {cat.category}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        {parseInt(cat.product_count).toLocaleString()}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">items</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-primary-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {cat.avg_nlc > 0 && (
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        avg ₹{fmt(cat.avg_nlc)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="px-5 py-3 border-t border-gray-50 dark:border-gray-700">
            <Link to="/products" className="text-xs text-primary-600 font-medium flex items-center gap-1">
              View all products <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Top Products by NLC */}
        <div className="glass-panel rounded-2xl animate-slide-up overflow-hidden" style={{ animationDelay: '0.6s' }}>
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2.5 bg-white/50 dark:bg-slate-800/50">
            <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-md">
              <Star className="w-4 h-4 text-amber-500" />
            </div>
            <h2 className="font-display font-bold text-slate-900 dark:text-white">Highest Value Products (MOP)</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {topProducts.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-400">No priced products</p>
            ) : topProducts.map((p, i) => (
              <div key={i} className="px-5 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    [{p.product_id}] · {p.category_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white">
                    ₹{fmt(p.dealer_price)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Price Updates */}
      <div className="glass-panel rounded-2xl animate-slide-up overflow-hidden" style={{ animationDelay: '0.7s' }}>
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center gap-2.5 bg-white/50 dark:bg-slate-800/50">
          <div className="p-1.5 bg-primary-50 dark:bg-primary-500/10 rounded-md">
            <TrendingUp className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="font-display font-bold text-slate-900 dark:text-white">Recent Price Updates</h2>
        </div>
        {recentUpdates.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <TrendingUp className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No price updates yet</p>
            <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">
              Updates will appear here when you edit product prices
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Product</th>
                  <th className="table-header">Field</th>
                  <th className="table-header">Old Value</th>
                  <th className="table-header">New Value</th>
                  <th className="table-header">When</th>
                </tr>
              </thead>
              <tbody>
                {recentUpdates.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="table-cell">
                      <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">{u.product_name}</p>
                      <p className="text-xs text-gray-400">{u.product_id}</p>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                        {u.field_name}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500">{u.old_value || '—'}</td>
                    <td className="table-cell font-semibold text-primary-600 dark:text-primary-400">{u.new_value}</td>
                    <td className="table-cell text-gray-400 text-xs whitespace-nowrap">
                      {new Date(u.updated_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductManagerDashboard;
