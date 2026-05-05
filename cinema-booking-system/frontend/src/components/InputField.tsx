import React from 'react';
import { LucideIcon } from 'lucide-react';

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  icon?: LucideIcon;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  required?: boolean;
}

export const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  type = 'text',
  placeholder,
  icon: Icon,
  value,
  onChange,
  error,
  required = false,
}) => {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest px-1"
      >
        {label}
        {required && <span className="text-error">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-outline w-5 h-5" />
        )}
        <input
          id={id}
          name={id}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={`w-full ${Icon ? 'pl-12' : 'pl-4'} pr-4 py-3 bg-surface-container-highest border-none rounded-lg focus:ring-0 text-sm placeholder:text-outline-variant transition-all border-b-2 ${
            error ? 'border-error focus:border-error' : 'border-transparent focus:border-primary'
          }`}
        />
      </div>
      {error && <p className="text-[12px] text-error px-1">{error}</p>}
    </div>
  );
};
