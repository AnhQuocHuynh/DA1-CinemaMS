import React from 'react';

const legendItems = [
  { label: 'Available', className: 'bg-primary-fixed' },
  { label: 'Selected', className: 'bg-primary' },
  { label: 'Holding', className: 'bg-tertiary-container' },
  { label: 'Sold', className: 'bg-secondary-container' },
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
    </div>
  );
};
