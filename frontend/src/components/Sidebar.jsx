import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  FileSpreadsheet,
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
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-16 bottom-0 z-40 glass-panel border-r-0 shadow-lg
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
      `}>
        <div className="flex flex-col h-full py-4">
          {/* Close button for mobile */}
          <div className="lg:hidden px-4 mb-4 flex justify-end">
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <NavLink
                  key={`${item.path}-${item.label}`}
                  to={item.path}
                  onClick={() => onClose()}
                  className={`
                    sidebar-link ${isActive ? 'active' : ''}
                    ${!isOpen && 'lg:justify-center'}
                  `}
                  title={!isOpen ? item.label : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className={`${!isOpen ? 'lg:hidden' : ''} transition-opacity`}>
                    {item.label}
                  </span>
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="px-3 mt-auto">
            <div className={`
              p-3 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50
              ${!isOpen ? 'lg:hidden' : ''}
            `}>
              <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold tracking-wide">
                Price List
              </p>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-medium">
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
