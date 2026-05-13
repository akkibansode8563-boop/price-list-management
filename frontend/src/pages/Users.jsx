import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  Search, Plus, Edit2, Lock, UserCheck, UserX, ChevronLeft, ChevronRight,
  X, Check, Shield, Package
} from 'lucide-react';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0
  });
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...(searchQuery && { search: searchQuery }),
        ...(roleFilter && { role: roleFilter })
      });
      const response = await api.get(`/users?${params}`);
      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get('/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(timeout);
  }, [pagination.page, pagination.limit, searchQuery, roleFilter]);

  const handleToggleActive = async (userId, currentStatus) => {
    try {
      await api.put(`/users/${userId}`, { isActive: !currentStatus });
      toast.success(`User ${!currentStatus ? 'activated' : 'deactivated'}`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to update user status');
    }
  };

  const handleResetPassword = async () => {
    try {
      await api.post(`/users/${resetUserId}/reset-password`, { newPassword });
      toast.success('Password reset successfully');
      setShowResetModal(false);
      setNewPassword('');
      setResetUserId(null);
    } catch (error) {
      toast.error('Failed to reset password');
    }
  };

  const UserModal = () => {
    const [formData, setFormData] = useState(editingUser || {
      email: '', firstName: '', lastName: '', password: '',
      role: 'sales_manager', phone: '', assignedCategories: []
    });

    const handleSubmit = async (e) => {
      e.preventDefault();
      try {
        if (editingUser) {
          await api.put(`/users/${editingUser.id}`, {
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            assignedCategories: formData.assignedCategories
          });
          toast.success('User updated');
        } else {
          await api.post('/users', formData);
          toast.success('User created');
        }
        setShowModal(false);
        setEditingUser(null);
        fetchUsers();
      } catch (error) {
        toast.error(error.response?.data?.message || 'Operation failed');
      }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between rounded-t-2xl">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {editingUser ? 'Edit User' : 'Add New User'}
            </h2>
            <button onClick={() => { setShowModal(false); setEditingUser(null); }} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">First Name *</label>
                <input type="text" required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="input-field" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Last Name *</label>
                <input type="text" required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="input-field" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input type="email" required disabled={!!editingUser} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="input-field" />
              </div>
              {!editingUser && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                  <input type="password" required={!editingUser} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="input-field" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role *</label>
                <select required disabled={!!editingUser} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className="input-field">
                  <option value="sales_manager">Sales Manager</option>
                  <option value="product_manager">Product Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="input-field" />
              </div>
              {formData.role === 'product_manager' && (
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned Categories</label>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 max-h-40 overflow-y-auto">
                    {categories.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 py-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.assignedCategories.includes(cat.id.toString())}
                          onChange={e => {
                            const cats = e.target.checked
                              ? [...formData.assignedCategories, cat.id.toString()]
                              : formData.assignedCategories.filter(id => id !== cat.id.toString());
                            setFormData({...formData, assignedCategories: cats});
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button type="button" onClick={() => { setShowModal(false); setEditingUser(null); }} className="btn-secondary">Cancel</button>
              <button type="submit" className="btn-primary">
                {editingUser ? 'Update User' : 'Create User'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Manage system users and permissions
          </p>
        </div>
        <button onClick={() => { setEditingUser(null); setShowModal(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPagination(prev => ({...prev, page: 1})); }}
              className="input-field pl-10"
            />
          </div>
          <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPagination(prev => ({...prev, page: 1})); }} className="input-field w-full sm:w-48">
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="product_manager">Product Manager</option>
            <option value="sales_manager">Sales Manager</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-header">User</th>
                <th className="table-header">Role</th>
                <th className="table-header">Phone</th>
                <th className="table-header">Status</th>
                <th className="table-header">Last Login</th>
                <th className="table-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-cell text-center py-12 text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                          <span className="text-sm font-semibold text-primary-700 dark:text-primary-400">
                            {user.first_name?.[0]}{user.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">{user.first_name} {user.last_name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${
                        user.role === 'super_admin' ? 'bg-purple-50 text-purple-600 dark:bg-purple-900/20' :
                        user.role === 'product_manager' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/20' :
                        'bg-gray-50 text-gray-600 dark:bg-gray-700'
                      }`}>
                        {user.role?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">{user.phone || '-'}</td>
                    <td className="table-cell">
                      <span className={`badge ${user.is_active ? 'badge-success' : 'badge-danger'}`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400 text-xs">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { setEditingUser(user); setShowModal(true); }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-primary-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setResetUserId(user.id); setShowResetModal(true); }}
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-orange-600"
                          title="Reset Password"
                        >
                          <Lock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.id, user.is_active)}
                          className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${user.is_active ? 'text-danger-600' : 'text-success-600'}`}
                          title={user.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of {pagination.totalCount}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagination(prev => ({...prev, page: prev.page - 1}))}
                disabled={pagination.page === 1}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700 dark:text-gray-300">Page {pagination.page} of {pagination.totalPages}</span>
              <button
                onClick={() => setPagination(prev => ({...prev, page: prev.page + 1}))}
                disabled={pagination.page === pagination.totalPages}
                className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && <UserModal />}

      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Reset Password</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="input-field" placeholder="Min 8 characters" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => { setShowResetModal(false); setNewPassword(''); }} className="btn-secondary">Cancel</button>
                <button onClick={handleResetPassword} className="btn-primary">Reset</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
