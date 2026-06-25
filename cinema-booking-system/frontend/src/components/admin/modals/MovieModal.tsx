import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { uploadImageToCloudinary } from '../../../utils/cloudinary';

interface MovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  initialData?: any;
}

export const MovieModal: React.FC<MovieModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    durationMinutes: '',
    releaseDate: '',
    ageRating: 'PG-13',
    posterUrl: '',
    trailerUrl: '',
    language: 'English',
    active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPoster, setIsUploadingPoster] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        title: initialData.title || '',
        description: initialData.description || '',
        durationMinutes: initialData.durationMinutes || '',
        releaseDate: initialData.releaseDate ? new Date(initialData.releaseDate).toISOString().split('T')[0] : '',
        ageRating: initialData.ageRating || 'PG-13',
        posterUrl: initialData.posterUrl || '',
        trailerUrl: initialData.trailerUrl || '',
        language: initialData.language || 'English',
        active: initialData.active ?? true,
      });
    } else {
      setFormData({
        title: '',
        description: '',
        durationMinutes: '',
        releaseDate: '',
        ageRating: 'PG-13',
        posterUrl: '',
        trailerUrl: '',
        language: 'English',
        active: true,
      });
    }
  }, [initialData, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPoster(true);
    try {
      const url = await uploadImageToCloudinary(file);
      setFormData((prev) => ({ ...prev, posterUrl: url }));
      addToast('Image uploaded successfully', 'success');
    } catch (err: any) {
      addToast(err?.message || 'Failed to upload image', 'error');
    } finally {
      setIsUploadingPoster(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Validation
    if (!formData.title.trim()) return addToast('Title is required', 'error');
    if (!formData.durationMinutes || isNaN(Number(formData.durationMinutes)) || Number(formData.durationMinutes) <= 0) {
      return addToast('Duration must be a valid positive number', 'error');
    }
    if (!formData.releaseDate) return addToast('Release Date is required', 'error');
    if (!formData.posterUrl) return addToast('Poster URL is required', 'error');

    setIsSubmitting(true);
    try {
      await onSubmit({
        ...formData,
        durationMinutes: Number(formData.durationMinutes),
        genreIds: [1, 2] // Mock genres for now, could be dynamic
      });
      addToast(`Movie successfully ${initialData ? 'updated' : 'added'}!`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to save movie', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-xl font-bold text-on-surface">{initialData ? 'Edit Movie' : 'Add New Movie'}</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md hover:bg-surface-container">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form id="movie-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Movie Title <span className="text-error">*</span></label>
                <input required type="text" name="title" value={formData.title} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. Inception" />
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Duration (mins) <span className="text-error">*</span></label>
                <input required type="number" min="1" name="durationMinutes" value={formData.durationMinutes} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. 148" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Release Date <span className="text-error">*</span></label>
                <input required type="date" name="releaseDate" value={formData.releaseDate} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Age Rating</label>
                <select name="ageRating" value={formData.ageRating} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none">
                  <option value="G">G</option>
                  <option value="PG">PG</option>
                  <option value="PG-13">PG-13</option>
                  <option value="R">R</option>
                  <option value="NC-17">NC-17</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Language</label>
                <input type="text" name="language" value={formData.language} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="e.g. English" />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Poster URL <span className="text-error">*</span></label>
                <div className="flex gap-2 items-center">
                  <input required type="url" name="posterUrl" value={formData.posterUrl} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="https://..." />
                  <label className="cursor-pointer bg-primary text-white px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-center hover:bg-blue-700 transition-colors whitespace-nowrap h-full">
                    {isUploadingPoster ? 'Uploading...' : 'Upload Image'}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingPoster} />
                  </label>
                </div>
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Trailer URL</label>
                <input type="url" name="trailerUrl" value={formData.trailerUrl} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none" placeholder="https://youtube.com/..." />
              </div>

              <div className="space-y-1 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Description</label>
                <textarea rows={3} name="description" value={formData.description} onChange={handleChange} className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none resize-none" placeholder="Movie synopsis..."></textarea>
              </div>

              <div className="space-y-1 md:col-span-2 flex items-center gap-3 mt-2">
                <input type="checkbox" id="active" name="active" checked={formData.active} onChange={handleChange} className="w-4 h-4 text-primary rounded focus:ring-primary border-slate-300" />
                <label htmlFor="active" className="text-sm font-semibold text-slate-700 cursor-pointer">Movie is active and visible</label>
              </div>
            </div>
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" form="movie-form" disabled={isSubmitting} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-white hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20">
            {isSubmitting ? 'Saving...' : 'Save Movie'}
          </button>
        </div>
      </div>
    </div>
  );
};
