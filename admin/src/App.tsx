import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { RealTimeAlerts } from './components/RealTimeAlerts';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Orders } from './pages/Orders';
import { Products } from './pages/Products';
import { Coupons } from './pages/Coupons';
import { Reviews } from './pages/Reviews';
import { Customers } from './pages/Customers';
import { Notifications } from './pages/Notifications';
import { Deals } from './pages/Deals';

const ProtectedLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 text-chai-800 font-bold">
        Loading Vardhamrit Admin...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <RealTimeAlerts />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/products" element={<Products />} />
        <Route path="/coupons" element={<Coupons />} />
        <Route path="/deals" element={<Deals />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/*" element={<ProtectedLayout />} />
    </Routes>
  );
};

export default App;
