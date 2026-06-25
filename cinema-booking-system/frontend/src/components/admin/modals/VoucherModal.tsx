import React, { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';

interface VoucherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

export const VoucherModal: React.FC<VoucherModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxDiscountAmount: '',
    validFrom: '',
    validUntil: '',
    usageLimit: '',
    active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value 
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return addToast('Code is required', 'error');
    if (!formData.discountValue.trim() || isNaN(parseFloat(formData.discountValue))) return addToast('Discount amount must be a number', 'error');

    setIsSubmitting(true);
    try {
      await onSubmit({
        code: formData.code.toUpperCase(),
        discountType: formData.discountType,
        discountValue: parseFloat(formData.discountValue),
        maxDiscountAmount: formData.maxDiscountAmount ? parseFloat(formData.maxDiscountAmount) : null,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : null,
        validFrom: formData.validFrom ? new Date(formData.validFrom).toISOString() : null,
        validUntil: formData.validUntil ? new Date(formData.validUntil).toISOString() : null,
        active: formData.active,
      });
      addToast('Voucher successfully created!', 'success');
      setFormData({ 
        code: '', discountType: 'PERCENTAGE', discountValue: '', maxDiscountAmount: '', 
        validFrom: '', validUntil: '', usageLimit: '', active: true 
      });
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to create voucher', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-xl font-bold text-on-surface">Create Voucher</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1 rounded-md">✕</button>
        </div>
        
        <div className="p-6">
          <form id="voucher-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Voucher Code <span className="text-error">*</span></label>
              <input required type="text" name="code" value={formData.code} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary uppercase" placeholder="SUMMER50" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Discount Type</label>
                <select name="discountType" value={formData.discountType} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FIXED_AMOUNT">Fixed Amount ($)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Value <span className="text-error">*</span></label>
                <input required type="number" step="0.01" name="discountValue" value={formData.discountValue} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. 20 or 5.00" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Max Discount Amount (Optional)</label>
              <input type="number" step="0.01" name="maxDiscountAmount" value={formData.maxDiscountAmount} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Cap for percentage discounts" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Valid From</label>
                <input type="datetime-local" name="validFrom" value={formData.validFrom} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Valid Until</label>
                <input type="datetime-local" name="validUntil" value={formData.validUntil} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Usage Limit</label>
              <input type="number" name="usageLimit" value={formData.usageLimit} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Leave empty for unlimited" />
            </div>

            <div className="space-y-1 flex items-center gap-3 pt-2">
              <input type="checkbox" id="activeVoucher" name="active" checked={formData.active} onChange={handleChange} className="w-4 h-4 text-primary rounded focus:ring-primary border-slate-300" />
              <label htmlFor="activeVoucher" className="text-sm font-semibold text-slate-700 cursor-pointer">Voucher is Active</label>
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" form="voucher-form" disabled={isSubmitting} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-white hover:bg-blue-700">
            {isSubmitting ? 'Creating...' : 'Create Voucher'}
          </button>
        </div>
      </div>
    </div>
  );
};
