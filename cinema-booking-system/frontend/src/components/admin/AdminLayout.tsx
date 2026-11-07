import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { useAuthStore } from '../../store/authStore';
import { authService } from '../../services/authService';

interface AdminLayoutProps {
  activeItemId?: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activeItemId, children }) => {
  const navigate = useNavigate();
  const { logout } = useAuthStore();

  const handleLogout = async () => {
    await authService.logout();
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar 
        activeItemId={activeItemId} 
        onLogout={handleLogout} 
        onSettings={() => navigate('/admin/settings')}
      />
      <div className="md:ml-64 min-h-screen">{children}</div>
    </div>
  );
};
