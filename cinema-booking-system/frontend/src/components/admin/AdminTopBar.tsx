import React from 'react';
interface AdminTopBarLink {
  label: string;
  to: string;
}

interface AdminTopBarProps {
  title: string;
  navLinks?: AdminTopBarLink[];
  searchPlaceholder?: string;
  actions?: React.ReactNode;
}

export const AdminTopBar: React.FC<AdminTopBarProps> = () => {
  return null;
};
