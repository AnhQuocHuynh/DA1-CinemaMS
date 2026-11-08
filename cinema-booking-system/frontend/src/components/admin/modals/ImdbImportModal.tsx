import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { movieService } from '../../../services/movieService';

interface ImdbImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImdbImportModal: React.FC<ImdbImportModalProps> = ({ isOpen, onClose }) => {
  const { t } = useTranslation();
  const [genres, setGenres] = useState<{ id: number; name: string }[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    movieService.getGenres().then(setGenres).catch(() => setGenres([]));
  }, [isOpen]);

  if (!isOpen) return null;

  const toggle = (name: string) => {
    setSelected((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  };

  const submit = async () => {
    if (selected.length === 0) {
      setMessage(t('adminMovies.pickGenre', 'Choose at least one genre.'));
      return;
    }
    const safeLimit = Math.min(100, Math.max(1, limit));
    setIsSubmitting(true);
    setMessage('');
    try {
      await Promise.all(selected.map((genre) => movieService.massImportByGenre(genre, safeLimit)));
      setMessage(t('adminMovies.importStarted', 'Import started. New movies appear after IMDb responds.'));
    } catch {
      setMessage(t('adminMovies.importFailed', 'Could not start the import.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl bg-surface-container-lowest border border-outline-variant p-6 space-y-4">
        <h2 className="text-xl font-bold">{t('adminMovies.importTitle', 'Import from IMDb')}</h2>
        <p className="text-sm text-on-surface-variant">
          {t('adminMovies.importHelp', 'Each selected genre starts its own background import.')}
        </p>
        <div className="max-h-52 overflow-auto grid grid-cols-2 gap-2">
          {genres.map((genre) => (
            <label key={genre.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(genre.name)}
                onChange={() => toggle(genre.name)}
              />
              {genre.name}
            </label>
          ))}
        </div>
        <label className="block text-sm">
          {t('adminMovies.limit', 'Movies per genre (1-100)')}
          <input
            type="number"
            min={1}
            max={100}
            value={limit}
            onChange={(event) => setLimit(Number(event.target.value))}
            className="mt-1 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2"
          />
        </label>
        {message && <p className="text-sm">{message}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg bg-surface-container-high">
            {t('adminMovies.close', 'Close')}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={submit}
            className="px-4 py-2 rounded-lg bg-primary text-on-primary disabled:opacity-50"
          >
            {t('adminMovies.startImport', 'Start import')}
          </button>
        </div>
      </div>
    </div>
  );
};
