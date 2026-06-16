import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';

interface TheaterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
}

export const TheaterModal: React.FC<TheaterModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    phone: '',
    active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        address: initialData.address || '',
        city: initialData.region || initialData.city || '',
        phone: initialData.phone || '',
        active: initialData.active ?? true,
      });
    } else {
      setFormData({ name: '', address: '', city: '', phone: '', active: true });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return addToast('Name is required', 'error');
    if (!formData.city.trim()) return addToast('City/Region is required', 'error');

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      addToast(`Theater successfully ${initialData ? 'updated' : 'added'}!`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to save theater', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-xl font-bold text-on-surface">{initialData ? 'Edit Theater' : 'Add New Theater'}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1 rounded-md hover:bg-surface-container">✕</button>
        </div>
        
        <div className="p-6">
          <form id="theater-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Theater Name <span className="text-error">*</span></label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Star Cinema HCMC" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">City / Region <span className="text-error">*</span></label>
              <input required type="text" name="city" value={formData.city} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="HCMC" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Address</label>
              <input type="text" name="address" value={formData.address} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="123 Example St." />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone</label>
              <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="0123456789" />
            </div>

            <div className="flex items-center gap-3 mt-4">
              <input type="checkbox" id="t-active" name="active" checked={formData.active} onChange={handleChange} className="w-4 h-4 text-primary rounded" />
              <label htmlFor="t-active" className="text-sm font-semibold text-slate-700 cursor-pointer">Theater is active and operating</label>
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" form="theater-form" disabled={isSubmitting} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-white hover:bg-blue-700">
            {isSubmitting ? 'Saving...' : 'Save Theater'}
          </button>
        </div>
      </div>
    </div>
  );
};
