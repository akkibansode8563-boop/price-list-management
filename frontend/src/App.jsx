import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const ProductManagerDashboard = lazy(() => import('./pages/ProductManagerDashboard'));
const SalesDashboard = lazy(() => import('./pages/SalesDashboard'));
const Products = lazy(() => import('./pages/Products'));
const Users = lazy(() => import('./pages/Users'));
const Profile = lazy(() => import('./pages/Profile'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingFallback />;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingFallback />;

  if (user) {
    const redirectMap = {
      super_admin: '/admin',
      product_manager: '/pm-dashboard',
      sales_manager: '/products'
    };
    return <Navigate to={redirectMap[user.role] || '/'} replace />;
  }

  return children;
};

const RoleBasedDashboard = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  switch (user.role) {
    case 'super_admin':
      return <AdminDashboard />;
    case 'product_manager':
      return <ProductManagerDashboard />;
    case 'sales_manager':
      return <Navigate to="/products" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
};

function App() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } />

        <Route element={<Layout />}>
          <Route path="/" element={<RoleBasedDashboard />} />

          <Route path="/admin" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          } />

          <Route path="/pm-dashboard" element={
            <ProtectedRoute allowedRoles={['product_manager']}>
              <ProductManagerDashboard />
            </ProtectedRoute>
          } />

          <Route path="/sales-dashboard" element={
            <ProtectedRoute allowedRoles={['sales_manager']}>
              <SalesDashboard />
            </ProtectedRoute>
          } />

          <Route path="/products" element={
            <ProtectedRoute allowedRoles={['super_admin', 'product_manager', 'sales_manager']}>
              <Products />
            </ProtectedRoute>
          } />

          <Route path="/users" element={
            <ProtectedRoute allowedRoles={['super_admin']}>
              <Users />
            </ProtectedRoute>
          } />

          <Route path="/profile" element={
            <ProtectedRoute allowedRoles={['super_admin', 'product_manager', 'sales_manager']}>
              <Profile />
            </ProtectedRoute>
          } />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
