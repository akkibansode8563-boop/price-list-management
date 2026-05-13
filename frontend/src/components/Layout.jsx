import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const Layout = () => {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1120]">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />

      <div className="flex pt-16">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
        />

        {/* On mobile: no left margin (sidebar is off-canvas overlay).
            On desktop: margin matches sidebar width */}
        <main className={`
          flex-1 transition-all duration-300 overflow-x-hidden
          lg:${sidebarOpen ? 'ml-64' : 'ml-20'}
          min-h-[calc(100vh-4rem)]
        `}>
          <div className="p-3 sm:p-5 lg:p-8 max-w-[1400px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
