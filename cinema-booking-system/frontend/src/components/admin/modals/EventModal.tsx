import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { adminService } from '../../../services/adminService';
import { AdminTheater } from '../../../types/admin';
import { useToast } from '../../../contexts/ToastContext';
import { uploadImageToCloudinary } from '../../../utils/cloudinary';

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
}

export const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
}) => {
  const { addToast } = useToast();
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startTime: '',
    venue: '',
    roomId: '',
    basePrice: '',
    imageUrl: '',
    active: true,
  });

  const [theaters, setTheaters] = useState<AdminTheater[]>([]);
  useEffect(() => {
    adminService.getTheaters().then(setTheaters).catch(console.error);
  }, []);

  const [duration, setDuration] = useState({
    hours: 2,
    minutes: 0,
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        startTime: initialData.startTime ? initialData.startTime.slice(0, 16) : '',
        venue: initialData.venue || '',
        roomId: initialData.roomId || '',
        basePrice: initialData.basePrice || '',
        imageUrl: initialData.imageUrl || '',
        active: initialData.active ?? true,
      });

      if (initialData.startTime && initialData.endTime) {
        const start = new Date(initialData.startTime).getTime();
        const end = new Date(initialData.endTime).getTime();
        const diffMs = Math.max(0, end - start);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setDuration({ hours, minutes });
      }
    } else {
      setFormData({
        name: '',
        description: '',
        startTime: '',
        venue: '',
        roomId: '',
        basePrice: '',
        imageUrl: '',
        active: true,
      });
      setDuration({ hours: 2, minutes: 0 });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setFormData((prev) => ({ ...prev, imageUrl: url }));
      addToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const startDt = new Date(formData.startTime);
    const endDt = new Date(startDt.getTime() + (duration.hours * 60 * 60 * 1000) + (duration.minutes * 60 * 1000));
    
    
    await onSubmit({
      ...formData,
      roomId: Number(formData.roomId),
      basePrice: Number(formData.basePrice),
      startTime: startDt.toISOString(),
      endTime: endDt.toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {initialData ? 'Edit Event' : 'Add New Event'}
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Event Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Start Time</label>
                <input
                  required
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Duration</label>
                <div className="flex gap-2">
                  <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                    <input
                      required
                      type="number"
                      min="0"
                      value={duration.hours}
                      onChange={(e) => setDuration({ ...duration, hours: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border-none focus:ring-0 text-center"
                    />
                    <span className="pr-3 text-slate-500 text-sm font-medium">hrs</span>
                  </div>
                  <div className="flex-1 flex items-center border border-slate-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 bg-white">
                    <input
                      required
                      type="number"
                      min="0"
                      max="59"
                      value={duration.minutes}
                      onChange={(e) => setDuration({ ...duration, minutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border-none focus:ring-0 text-center"
                    />
                    <span className="pr-3 text-slate-500 text-sm font-medium">min</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Venue (Room)</label>
                <select
                  required
                  value={formData.roomId}
                  onChange={(e) => {
                    const roomId = e.target.value;
                    const theater = theaters.find(t => t.rooms.some(r => r.id === roomId));
                    const room = theater?.rooms.find(r => r.id === roomId);
                    const venueStr = theater && room ? `${theater.name} - ${room.name}` : '';
                    setFormData({ ...formData, roomId, venue: venueStr });
                  }}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select a room</option>
                  {theaters.map((theater) => (
                    <optgroup key={theater.id} label={theater.name}>
                      {theater.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Base Price (VND)</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="1000"
                  value={formData.basePrice}
                  onChange={(e) => setFormData({ ...formData, basePrice: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Image URL</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <label className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center justify-center hover:bg-blue-700 transition-colors whitespace-nowrap h-full">
                    {isUploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                  </label>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm font-semibold text-slate-700">Active</span>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            form="event-form"
            type="submit"
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm"
          >
            {initialData ? 'Save Changes' : 'Add Event'}
          </button>
        </div>
      </div>
    </div>
  );
};
