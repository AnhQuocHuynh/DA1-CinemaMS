import React, { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminEvents } from '../../hooks/useAdminEvents';
import { EventModal } from '../../components/admin/modals/EventModal';
import { RatingBadge } from '../../components/Review/RatingBadge';
import { useTranslation } from 'react-i18next';

export const EventManagement: React.FC = () => {
  const { t } = useTranslation();
  const { events, isLoading, addEvent, deleteEvent } = useAdminEvents();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const handleAddClick = () => {
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (id: number) => {
    if (window.confirm(t('adminEvents.deleteConfirm', 'Are you sure you want to delete this event?'))) {
      await deleteEvent(id);
    }
  };

  const handleModalSubmit = async (data: any) => {
    if (selectedEvent) {
      // API currently does not support updating events (PUT)
      alert(t('adminEvents.updateNotSupported', "Event update not currently supported by backend. Try deleting and creating a new one."));
    } else {
      await addEvent(data);
    }
  };

  return (
    <AdminLayout activeItemId="events">
      <AdminTopBar title={t('adminEvents.console', 'Admin Console')} searchPlaceholder={t('adminEvents.search', 'Search events or status...')} />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          eyebrow={t('adminEvents.eyebrow', 'Catalog Control')}
          title={t('adminEvents.title', 'Event Management')}
          subtitle={t('adminEvents.subtitle', 'Curate special events, adjust availability, and maintain the lineup.')}
          actions={
            <button onClick={handleAddClick} className="px-4 py-2 bg-amber-600 text-white rounded-lg font-semibold text-sm hover:bg-amber-700 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {t('adminEvents.addEvent', 'Add Event')}
            </button>
          }
        />

        <section className="mt-10 bg-surface-container-lowest rounded-xl overflow-hidden border border-outline-variant/20">
          <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low/40">
            <div className="flex items-center gap-3 bg-surface-container-highest px-4 py-2 rounded-lg w-full md:w-80">
              <Search className="w-4 h-4 text-outline" />
              <input
                className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline"
                placeholder={t('adminEvents.searchName', 'Search by name')}
                type="text"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-on-surface-variant">{t('adminEvents.loading', 'Loading events...')}</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container-low/50">
                <tr>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.name', 'Name')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.venue', 'Venue')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.startTime', 'Start Time')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.endTime', 'End Time')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.status', 'Status')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary">{t('adminEvents.rating', 'Rating')}</th>
                  <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-bold text-secondary text-right">{t('adminEvents.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-surface-container-low transition-colors">
                    <td className="px-6 py-4 font-medium text-on-surface">{event.name}</td>
                    <td className="px-6 py-4 text-sm text-on-surface">{event.venue}</td>
                    <td className="px-6 py-4 text-sm text-on-surface">{new Date(event.startTime).toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4 text-sm text-on-surface">{new Date(event.endTime).toLocaleString('vi-VN')}</td>
                    <td className="px-6 py-4">
                      {event.active ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{t('adminEvents.active', 'Active')}</span>
                      ) : (
                        <span className="bg-surface-container text-on-surface-variant border border-outline-variant px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">{t('adminEvents.deleted', 'Deleted')}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface"><RatingBadge type="event" id={event.id} /></td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {event.active && (
                        <button onClick={() => handleDeleteClick(event.id)} className="px-3 py-1 bg-error text-on-error rounded text-xs hover:opacity-90">{t('adminEvents.delete', 'Delete')}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>

      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleModalSubmit}
        initialData={selectedEvent}
      />
    </AdminLayout>
  );
};
