import React from 'react';
import { useTranslation } from 'react-i18next';
import { StaffLayout } from '../../components/staff/StaffLayout';
import { RentalManagementView } from '../../components/rental/RentalManagementView';

export const StaffRentalManagement: React.FC = () => {
  const { t } = useTranslation();

  return (
    <StaffLayout
      activeItemId="rentals"
      searchPlaceholder={t('staffRentals.searchPlaceholder', 'Search rental ID or room...')}
    >
      <section className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <span className="text-[0.65rem] uppercase tracking-[0.15em] font-bold text-on-surface-variant mb-1 block">
            {t('staffRentals.operationalDashboard', 'Operational Dashboard')}
          </span>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">
            {t('staffRentals.title', 'Room Rental Operations')}
          </h2>
          <p className="text-on-surface-variant mt-2 text-sm max-w-xl">
            {t(
              'staffRentals.subtitle',
              'Review customer room rental requests, approve or reject bookings, and process counter cash payments.'
            )}
          </p>
        </div>
      </section>

      <RentalManagementView mode="STAFF" />
    </StaffLayout>
  );
};
