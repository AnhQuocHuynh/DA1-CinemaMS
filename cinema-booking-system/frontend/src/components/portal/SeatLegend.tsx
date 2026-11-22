import React from 'react';

import { useTranslation } from 'react-i18next';

export const SeatLegend: React.FC = () => {
  const { t } = useTranslation();

  const legendItems = [
    { label: t('seatLegend.available', 'Available'), className: 'bg-success' },
    { label: t('seatLegend.holding', 'Holding'), className: 'bg-yellow-200 ring-2 ring-gray-400' },
    { label: t('seatLegend.sold', 'Sold'), className: 'bg-gray-400' },
  ];
  return (
    <div className="mt-16 flex flex-wrap justify-center gap-8 py-6 bg-surface-container-low rounded-xl">
      {legendItems.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-sm ${item.className}`} />
          <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">
            {item.label}
          </span>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 rounded-sm bg-gradient-to-br from-amber-200 to-amber-500 border border-amber-600" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{t('seatLegend.vip', 'VIP')}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-11 h-5 rounded-md bg-pink-500 hover:bg-pink-600 transition-colors" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">{t('seatLegend.coupleSeat', 'Couple Seat')}</span>
      </div>
    </div>
  );
};
