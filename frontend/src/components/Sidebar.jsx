import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  Heart,
  X
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose }) => {
  const { hasRole } = useAuth();
  const location = useLocation();

  const getNavItems = () => {
    const items = [];

    if (hasRole('super_admin')) {
      items.push(
        { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/products', icon: Package, label: 'Products' },
        { path: '/users', icon: Users, label: 'Users' },
        { path: '/profile', icon: Settings, label: 'Settings' }
      );
    }

    if (hasRole('product_manager')) {
      items.push(
        { path: '/pm-dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/products', icon: Package, label: 'My Products' },
        { path: '/profile', icon: Settings, label: 'Settings' }
      );
    }

    if (hasRole('sales_manager')) {
      items.push(
        { path: '/products', icon: Package, label: 'Price List' },
        { path: '/profile', icon: Heart, label: 'Favorites' },
        { path: '/profile', icon: Settings, label: 'Settings' }
      );
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-16 bottom-0 z-40
          w-72 lg:w-20 lg:hover:w-64
          glass-panel border-r border-slate-200/50 dark:border-slate-700/30 shadow-xl
          transition-all duration-300 ease-in-out
          group overflow-hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="flex flex-col h-full py-4">
          {/* Mobile close header */}
          <div className="lg:hidden px-4 mb-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              Menu
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Nav items */}
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  onClick={onClose}
                  title={item.label}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isActive
                      ? 'text-primary-700 bg-primary-50 dark:text-primary-400 dark:bg-primary-500/10'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          {/* Footer branding */}
          <div className="px-3 mt-auto">
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50">
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                DCC Infotech Pvt. Ltd.
              </p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-medium whitespace-nowrap lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                Version 1.0.0
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
