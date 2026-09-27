import React, { useState } from 'react';
import { useToast } from '../../../contexts/ToastContext';

interface RoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  cinemaName: string;
  initialData?: any;
}

export const RoomModal: React.FC<RoomModalProps> = ({ isOpen, onClose, onSubmit, cinemaName, initialData }) => {
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

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        type: initialData.level || initialData.type || 'Standard',
        totalSeats: initialData.capacity || initialData.totalSeats || 100,
        rows: initialData.rows || 10,
        columns: initialData.columns || 10,
        active: initialData.status !== 'maintenance', // We default active to true if not maintenance
        underMaintenance: initialData.status === 'maintenance',
      });
    } else {
      setFormData({
        name: '',
        type: 'Standard',
        totalSeats: 100,
        rows: 10,
        columns: 10,
        active: true,
        underMaintenance: false,
      });
    }
  }, [initialData, isOpen]);

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
      addToast(`Room successfully ${initialData ? 'updated' : 'added'} for ${cinemaName}!`, 'success');
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
          <h2 className="text-xl font-bold text-on-surface">{initialData ? 'Edit Room in' : 'Add Room to'} {cinemaName}</h2>
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

            <div className="space-y-2 mt-4">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Room Status</label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="underMaintenance" checked={!formData.underMaintenance} onChange={() => setFormData(prev => ({...prev, underMaintenance: false, active: true}))} className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-slate-700">Operational</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="underMaintenance" checked={formData.underMaintenance} onChange={() => setFormData(prev => ({...prev, underMaintenance: true, active: true}))} className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-semibold text-slate-700">Under Maintenance</span>
                </label>
              </div>
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
