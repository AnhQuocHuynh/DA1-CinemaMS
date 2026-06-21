import React from 'react';
import { StaffSidebar } from './StaffSidebar';
import { StaffTopBar } from './StaffTopBar';

interface StaffLayoutProps {
  activeItemId?: string;
  children: React.ReactNode;
  searchPlaceholder?: string;
}

export const StaffLayout: React.FC<StaffLayoutProps> = ({
  activeItemId,
  children,
  searchPlaceholder,
}) => {
  return (
    <div className="min-h-screen bg-surface">
      <StaffSidebar activeItemId={activeItemId} />
      <div className="md:ml-64 min-h-screen">
        <StaffTopBar searchPlaceholder={searchPlaceholder} />
        <main className="px-6 md:px-8 py-8">{children}</main>
      </div>
    </div>
  );
};
