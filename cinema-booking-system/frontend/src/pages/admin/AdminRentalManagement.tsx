import React from 'react';
import { useTranslation } from 'react-i18next';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { RentalManagementView } from '../../components/rental/RentalManagementView';

export const AdminRentalManagement: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AdminLayout activeItemId="rentals">
      <AdminTopBar
        title={t('adminRentals.console', 'Admin Console')}
        searchPlaceholder={t('adminRentals.search', 'Search rentals or venue...')}
      />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          eyebrow={t('adminRentals.eyebrow', 'Venue Management')}
          title={t('adminRentals.title', 'Room Rental Console')}
          subtitle={t(
            'adminRentals.subtitle',
            'Oversee room rental requests, verify payments, approve bookings, and track revenue across all cinema branches.'
          )}
        />
        <div className="mt-8">
          <RentalManagementView mode="ADMIN" />
        </div>
      </main>
    </AdminLayout>
  );
};
