import React, { useState, useEffect } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { CinemaResponse } from '../../../services/cinemaService';

interface UserRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  onAssignCinema?: (userId: string | number, cinemaId: number | null) => Promise<void>;
  cinemas?: CinemaResponse[];
  user: any;
}

export const UserRoleModal: React.FC<UserRoleModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onAssignCinema,
  cinemas = [],
  user,
}) => {
  const { addToast } = useToast();
  const [activeRole, setActiveRole] = useState<'customer' | 'staff' | 'admin'>('customer');
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && user.roles) {
      if (user.roles.admin) setActiveRole('admin');
      else if (user.roles.staff) setActiveRole('staff');
      else setActiveRole('customer');

      setSelectedCinemaId(user.cinemaId ?? null);
    }
  }, [user, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const rolesToSubmit = {
        customer: activeRole === 'customer',
        staff: activeRole === 'staff',
        admin: activeRole === 'admin',
      };
      await onSubmit({ roles: rolesToSubmit });

      // Update cinema assignment if user is staff and onAssignCinema is provided
      if (onAssignCinema) {
        const targetCinemaId = activeRole === 'staff' ? selectedCinemaId : null;
        if (targetCinemaId !== (user.cinemaId ?? null)) {
          await onAssignCinema(user.id, targetCinemaId);
        }
      }

      addToast(`User settings updated for ${user.name}`, 'success');
      onClose();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update roles', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !user) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
          <h2 className="text-lg font-bold text-on-surface">Edit Roles</h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-error p-1 rounded-md">✕</button>
        </div>
        
        <div className="p-6 text-center">
          <div className="w-16 h-16 bg-blue-100 text-blue-700 font-bold flex items-center justify-center rounded-full text-xl mx-auto mb-4">
            {user.name.split(' ').map((p: string) => p[0]).join('')}
          </div>
          <h3 className="font-bold text-lg">{user.name}</h3>
          <p className="text-sm text-slate-500 mb-6">{user.email}</p>

          <form id="role-form" onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Access Level</label>
              <select 
                value={activeRole} 
                onChange={(e) => setActiveRole(e.target.value as any)}
                className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="customer">Customer</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {activeRole === 'staff' && (
              <div className="space-y-1 pt-2 border-t border-slate-100 animate-fade-in">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-widest text-slate-500">Assigned Cinema</label>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">Scope Guard</span>
                </div>
                <select
                  value={selectedCinemaId === null ? '' : String(selectedCinemaId)}
                  onChange={(e) => setSelectedCinemaId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full bg-surface-container-highest border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary outline-none"
                >
                  <option value="">-- Unassigned (No Cinema) --</option>
                  {cinemas.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.city ? `(${c.city})` : ''}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Staff can only scan tickets and approve rental requests for their assigned cinema.
                </p>
              </div>
            )}
          </form>
        </div>
        
        <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSubmitting} className="px-4 py-2 rounded-lg font-bold text-sm text-slate-600 hover:bg-slate-100">Cancel</button>
          <button type="submit" form="role-form" disabled={isSubmitting} className="px-6 py-2 rounded-lg font-bold text-sm bg-primary text-white hover:bg-blue-700">
            {isSubmitting ? 'Saving...' : 'Save Roles'}
          </button>
        </div>
      </div>
    </div>
  );
};
