import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Package, Users, FolderOpen, TrendingUp, Clock,
  ArrowUpRight, ArrowDownRight, Activity
} from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color, delay }) => (
  <div className={`glass-panel p-4 sm:p-6 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-slide-up`} style={{ animationDelay: delay }}>
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0 mr-2">
        <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase truncate">{title}</p>
        <p className="text-2xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white mt-1 sm:mt-2 tracking-tight">{value}</p>
        {trend && (
          <div className={`flex items-center gap-1 mt-2 sm:mt-3 text-xs sm:text-sm font-medium ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-danger-600 dark:text-danger-400'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" /> : <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <div className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br ${color} shadow-lg flex-shrink-0`}>
        <Icon className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
      </div>
    </div>
  </div>
);

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [recentUpdates, setRecentUpdates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/dashboard/admin');
      setStats(response.data.stats);
      setRecentUpdates(response.data.recentUpdates);
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
        <h1 className="text-xl sm:text-3xl font-display font-bold text-slate-900 dark:text-white tracking-tight">Admin Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm sm:text-base font-medium">Overview of your price list system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        <StatCard
          title="Total Products"
          value={stats?.totalProducts?.toLocaleString() || 0}
          icon={Package}
          color="from-blue-500 to-blue-600 shadow-blue-500/20"
          delay="0s"
        />
        <StatCard
          title="Total Users"
          value={stats?.totalUsers?.toLocaleString() || 0}
          icon={Users}
          color="from-emerald-400 to-emerald-600 shadow-emerald-500/20"
          delay="0.1s"
        />
        <StatCard
          title="Categories"
          value={stats?.totalCategories?.toLocaleString() || 0}
          icon={FolderOpen}
          color="from-indigo-500 to-purple-600 shadow-indigo-500/20"
          delay="0.2s"
        />
        <StatCard
          title="Price Changes Today"
          value={stats?.priceChangesToday?.toLocaleString() || 0}
          icon={TrendingUp}
          color="from-amber-400 to-orange-500 shadow-amber-500/20"
          trend="up"
          trendValue="vs yesterday"
          delay="0.3s"
        />
      </div>

      {/* Recent Updates Table */}
      <div className="glass-panel rounded-2xl animate-slide-up overflow-hidden" style={{ animationDelay: '0.4s' }}>
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 flex items-center justify-between bg-white/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary-50 dark:bg-primary-500/10 rounded-lg">
              <Activity className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-lg font-bold font-display text-slate-900 dark:text-white">Recent Price Updates</h2>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">Product</th>
                <th className="table-header">Field</th>
                <th className="table-header">Old Value</th>
                <th className="table-header">New Value</th>
                <th className="table-header">Updated By</th>
                <th className="table-header">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentUpdates.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-8 text-gray-500">
                    No recent updates
                  </td>
                </tr>
              ) : (
                recentUpdates.map((update) => (
                  <tr key={update.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="table-cell font-medium">{update.product_name}</td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {update.field_name}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">{update.old_value || '-'}</td>
                    <td className="table-cell">
                      <span className={`font-medium ${
                        parseFloat(update.new_value) > parseFloat(update.old_value)
                          ? 'text-danger-600'
                          : parseFloat(update.new_value) < parseFloat(update.old_value)
                          ? 'text-success-600'
                          : ''
                      }`}>
                        {update.new_value}
                      </span>
                    </td>
                    <td className="table-cell">{update.updated_by_name}</td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(update.updated_at).toLocaleString()}
                      </div>
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

export default AdminDashboard;
