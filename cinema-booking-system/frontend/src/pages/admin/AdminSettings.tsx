import React from 'react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { ProfileSettingsContent } from '../../components/profile/ProfileSettingsContent';

export const AdminSettings: React.FC = () => {
  return (
    <AdminLayout>
      <AdminTopBar
        title="Admin Console"
        searchPlaceholder="Search operations, venues, or reports..."
        navLinks={[
          { label: 'Analytics', to: '/admin/dashboard' },
          { label: 'Reports', to: '/admin/permissions' },
          { label: 'Logs', to: '/admin/showtimes' },
        ]}
      />

      <main className="p-6 md:p-10 bg-surface min-h-screen">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">Settings</h1>
          <p className="text-on-surface-variant mt-2">Manage your account preferences and profile.</p>
        </div>

        <div className="max-w-4xl">
          <ProfileSettingsContent />
        </div>
      </main>
    </AdminLayout>
  );
};
