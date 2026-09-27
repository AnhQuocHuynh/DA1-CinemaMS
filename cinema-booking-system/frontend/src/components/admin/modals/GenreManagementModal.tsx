import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { movieService } from '../../../services/movieService';
import { Trash2, Plus } from 'lucide-react';

interface GenreManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GenreManagementModal: React.FC<GenreManagementModalProps> = ({ isOpen, onClose }) => {
  const { addToast } = useToast();
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newGenre, setNewGenre] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadGenres();
    }
  }, [isOpen]);

  const loadGenres = async () => {
    setIsLoading(true);
    try {
      const data = await movieService.getGenres();
      setGenres(data);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load genres', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGenre.trim()) return;

    try {
      await movieService.createGenre(newGenre.trim());
      addToast('Genre added successfully', 'success');
      setNewGenre('');
      loadGenres();
    } catch (err: any) {
      addToast(err?.message || 'Failed to add genre', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this genre?')) return;

    try {
      await movieService.deleteGenre(id);
      addToast('Genre deleted successfully', 'success');
      loadGenres();
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete genre. It might be used in a movie.', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-xl font-bold text-on-surface">Manage Genres</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error transition-colors p-1 rounded-md hover:bg-surface-container">
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <form onSubmit={handleAdd} className="flex gap-2 mb-6">
            <input 
              type="text" 
              value={newGenre}
              onChange={(e) => setNewGenre(e.target.value)}
              placeholder="New genre name..."
              className="flex-1 bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
            />
            <button 
              type="submit" 
              disabled={!newGenre.trim()} 
              className="bg-primary text-on-primary p-3 rounded-lg hover:opacity-90 transition-colors disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
            </button>
          </form>

          {isLoading ? (
            <div className="text-center py-4 text-on-surface-variant">Loading genres...</div>
          ) : genres.length === 0 ? (
            <div className="text-center py-4 text-on-surface-variant">No genres found.</div>
          ) : (
            <div className="space-y-2">
              {genres.map((genre) => (
                <div key={genre.id} className="flex items-center justify-between bg-surface-container-low p-3 rounded-lg border border-outline-variant/30">
                  <span className="font-medium text-sm text-on-surface">{genre.name}</span>
                  <button 
                    onClick={() => handleDelete(genre.id)}
                    className="text-on-surface-variant hover:text-error p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-sm bg-surface-container hover:bg-surface-container-high transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
