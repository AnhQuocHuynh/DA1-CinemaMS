import React from 'react';

const legendItems = [
  { label: 'Available', className: 'bg-green-500' },
  { label: 'Holding', className: 'bg-yellow-400 ring-2 ring-gray-400' },
  { label: 'Sold', className: 'bg-gray-400' },
];

export const SeatLegend: React.FC = () => {
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
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">VIP</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-11 h-5 rounded-md bg-surface-container-high border border-outline-variant/30" />
        <span className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Couple Seat</span>
      </div>
    </div>
  );
};
