import React, { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  cinemaName: string;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onSubmit, cinemaName }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    type: 'Standard',
    totalSeats: 100,
    rows: 10,
    columns: 10,
    active: true,
    underMaintenance: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : false;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return addToast('Room Name is required', 'error');

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        totalSeats: Number(formData.totalSeats),
        rows: Number(formData.rows),
        columns: Number(formData.columns),
      });
      addToast(`Room successfully added to ${cinemaName}!`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to add room', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-xl font-bold text-on-surface">Add Room to {cinemaName}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1 rounded-md">✕</button>
        </div>
        
        <div className="p-6">
          <form id="room-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Room Name <span className="text-error">*</span></label>
              <input required type="text" name="name" value={formData.name} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary" placeholder="Screen 1" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Technology Type</label>
              <select name="type" value={formData.type} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm outline-none focus:ring-1 focus:ring-primary">
                <option value="Standard">Standard</option>
                <option value="3D">3D</option>
                <option value="IMAX">IMAX</option>
                <option value="4DX">4DX</option>
                <option value="VIP">VIP</option>
              </select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Rows</label>
                <input required type="number" name="rows" value={formData.rows} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Columns</label>
                <input required type="number" name="columns" value={formData.columns} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Seats</label>
                <input required type="number" name="totalSeats" value={formData.totalSeats} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm" />
              </div>
            </div>

            <div className="flex items-center gap-3 mt-4">
              <input type="checkbox" id="r-active" name="active" checked={formData.active} onChange={handleChange} className="w-4 h-4 text-primary rounded" />
              <label htmlFor="r-active" className="text-sm font-semibold text-slate-700 cursor-pointer">Room is active</label>
            </div>

            <div className="flex items-center gap-3 mt-2">
              <input type="checkbox" id="r-maint" name="underMaintenance" checked={formData.underMaintenance} onChange={handleChange} className="w-4 h-4 text-amber-500 rounded" />
              <label htmlFor="r-maint" className="text-sm font-semibold text-slate-700 cursor-pointer">Under Maintenance</label>
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" form="room-form" disabled={isSubmitting} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-white hover:bg-blue-700">
            {isSubmitting ? 'Saving...' : 'Save Room'}
          </button>
        </div>
      </div>
    </div>
  );
};
