import React from 'react';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  activeItemId?: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ activeItemId, children }) => {
  return (
    <div className="min-h-screen bg-surface">
      <AdminSidebar activeItemId={activeItemId} />
      <div className="md:ml-64 min-h-screen">{children}</div>
    </div>
  );
};
