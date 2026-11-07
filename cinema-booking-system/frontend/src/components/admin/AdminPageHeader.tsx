import React from 'react';

interface AdminPageHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  eyebrow,
  title,
  subtitle,
  actions,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
      <div>
        {eyebrow && (
          <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2 block">
            {eyebrow}
          </span>
        )}
        <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight">
          {title}
        </h1>
        {subtitle && <p className="text-on-surface-variant mt-2 font-medium">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
};
