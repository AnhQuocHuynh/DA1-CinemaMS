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
    discount: '',
    expiry: '',
    usageLimit: '',
    status: 'active',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code.trim()) return addToast('Code is required', 'error');
    if (!formData.discount.trim() || isNaN(parseInt(formData.discount))) return addToast('Discount amount must be a number', 'error');

    setIsSubmitting(true);
    try {
      await onSubmit({
        code: formData.code.toUpperCase(),
        discount: formData.discount,
        expiry: formData.expiry,
        usageLimit: formData.usageLimit ? parseInt(formData.usageLimit) : undefined,
        status: formData.status,
      });
      addToast('Voucher successfully created!', 'success');
      setFormData({ code: '', discount: '', expiry: '', usageLimit: '', status: 'active' });
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

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Discount Description / Amount <span className="text-error">*</span></label>
              <input required type="text" name="discount" value={formData.discount} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="50" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Expiry Date</label>
              <input type="date" name="expiry" value={formData.expiry} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Usage Limit</label>
              <input type="number" name="usageLimit" value={formData.usageLimit} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Leave empty for unlimited" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Status</label>
              <select name="status" value={formData.status} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
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
