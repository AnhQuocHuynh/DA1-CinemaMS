import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminRooms } from '../../hooks/useAdminRooms';
import { AdminTheater } from '../../types/admin';
import { TheaterModal } from '../../components/admin/modals/TheaterModal';
import { RoomModal } from '../../components/admin/modals/RoomModal';
import { AdminDataState, AdminTableSkeleton } from '../../components/admin/AdminDataState';
import { useTranslation } from 'react-i18next';
import { formatVND } from '../../utils/formatters';
import { rentalService } from '../../services/rentalService';
import { useToast } from '../../contexts/ToastContext';

export const RoomManagement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theaters, isLoading, isRetrying, retry, addTheater, updateTheater, deleteTheater, addRoom, updateRoom, deleteRoom } = useAdminRooms();

  const { addToast } = useToast();

  const [expandedTheaters, setExpandedTheaters] = useState<Record<string, boolean>>({
    'theater-1': true,
  });

  // Modal States
  const [isTheaterModalOpen, setIsTheaterModalOpen] = useState(false);
  const [selectedTheater, setSelectedTheater] = useState<any>(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedTheaterForRoom, setSelectedTheaterForRoom] = useState<{ id: string; name: string } | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  // Rental Rate State & Modal
  const [roomRates, setRoomRates] = useState<Record<string, number>>({});
  const [isRateModalOpen, setIsRateModalOpen] = useState(false);
  const [rateModalRoom, setRateModalRoom] = useState<{ id: string; name: string } | null>(null);
  const [rateInput, setRateInput] = useState<string>('150000');
  const [isFetchingRate, setIsFetchingRate] = useState(false);
  const [isSavingRate, setIsSavingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const toggleTheater = (theater: AdminTheater) => {
    setExpandedTheaters((prev) => ({
      ...prev,
      [theater.id]: !prev[theater.id],
    }));
  };

  const handleAddTheaterClick = () => {
    setSelectedTheater(null);
    setIsTheaterModalOpen(true);
  };

  const handleEditTheaterClick = (theater: AdminTheater) => {
    setSelectedTheater(theater);
    setIsTheaterModalOpen(true);
  };

  const handleDeleteTheaterClick = async (id: string) => {
    if (window.confirm(t('adminRooms.deleteTheaterConfirm', 'Are you sure you want to delete this theater? All rooms will also be deleted.'))) {
      await deleteTheater(id);
    }
  };

  const handleAddRoomClick = (theater: AdminTheater) => {
    setSelectedRoom(null);
    setSelectedTheaterForRoom({ id: theater.id, name: theater.name });
    setIsRoomModalOpen(true);
  };

  const handleEditRoomClick = (theater: AdminTheater, room: any) => {
    setSelectedRoom(room);
    setSelectedTheaterForRoom({ id: theater.id, name: theater.name });
    setIsRoomModalOpen(true);
  };

  const handleDeleteRoomClick = async (cinemaId: string, roomId: string) => {
    if (window.confirm(t('adminRooms.deleteRoomConfirm', 'Are you sure you want to delete this room?'))) {
      await deleteRoom(cinemaId, roomId);
    }
  };

  const handleTheaterSubmit = async (data: any) => {
    if (selectedTheater) {
      await updateTheater(selectedTheater.id, data);
    } else {
      await addTheater(data);
    }
  };

  const handleRoomSubmit = async (data: any) => {
    if (selectedTheaterForRoom) {
      if (selectedRoom) {
        await updateRoom(selectedTheaterForRoom.id, selectedRoom.id, data);
      } else {
        await addRoom(selectedTheaterForRoom.id, data);
      }
    }
  };

  const handleOpenRateModal = async (room: any) => {
    setRateModalRoom({ id: String(room.id), name: room.name });
    setRateError(null);
    setIsRateModalOpen(true);
    setIsFetchingRate(true);

    if (roomRates[room.id]) {
      setRateInput(String(roomRates[room.id]));
    } else {
      setRateInput('150000');
    }

    try {
      const tomorrowStr = dayjs().add(1, 'day').format('YYYY-MM-DD');
      const tomorrowStartISO = `${tomorrowStr}T08:00:00`;
      const tomorrowEndISO = `${tomorrowStr}T20:00:00`;

      const avail = await rentalService.getRoomAvailability(
        Number(room.id),
        tomorrowStartISO,
        tomorrowEndISO
      );

      if (avail && avail.pricePerHour && avail.pricePerHour > 0) {
        setRateInput(String(avail.pricePerHour));
        setRoomRates((prev) => ({ ...prev, [room.id]: avail.pricePerHour }));
      } else if (!roomRates[room.id]) {
        setRateInput('150000');
      }
    } catch (err) {
      console.warn('Could not fetch room rental rate, falling back to 150000', err);
      if (!roomRates[room.id]) {
        setRateInput('150000');
      }
    } finally {
      setIsFetchingRate(false);
    }
  };

  const handleSaveRentalRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateModalRoom) return;

    const numRate = Number(rateInput);
    if (isNaN(numRate) || numRate <= 0) {
      setRateError(t('adminRooms.rateInvalidError', 'Please enter a valid hourly rate greater than 0'));
      return;
    }

    setIsSavingRate(true);
    setRateError(null);
    try {
      await rentalService.setRoomRate(Number(rateModalRoom.id), numRate);
      setRoomRates((prev) => ({ ...prev, [rateModalRoom.id]: numRate }));
      addToast(
        t('adminRooms.rateUpdateSuccess', 'Rental rate updated successfully for {{roomName}}', {
          roomName: rateModalRoom.name,
        }),
        'success'
      );
      setIsRateModalOpen(false);
    } catch (err: any) {
      console.error('Failed to update room rental rate', err);
      setRateError(err?.response?.data?.message || t('adminRooms.rateUpdateError', 'Failed to update rental rate'));
    } finally {
      setIsSavingRate(false);
    }
  };

  const totalCapacity = theaters.reduce((acc, theater) =>
    acc + theater.rooms.reduce((roomAcc, room) => roomAcc + (room.capacity || 0), 0), 0
  );

  return (
    <AdminLayout activeItemId="rooms">
      <AdminTopBar title={t('adminRooms.console', 'Admin Console')} searchPlaceholder={t('adminRooms.search', 'Search theaters or rooms...')} />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          title={t('adminRooms.title', 'Theaters & Rooms')}
          subtitle={t('adminRooms.subtitle', 'Manage global venue infrastructure and technology specifications.')}
          actions={
            <button onClick={handleAddTheaterClick} className="bg-primary text-on-primary px-6 py-2.5 rounded hover:brightness-110 transition-all flex items-center gap-2 font-semibold text-sm">
              <Plus className="w-4 h-4" />
              {t('adminRooms.addTheater', 'Add New Theater')}
            </button>
          }
        />

        <AdminDataState
          isLoading={isLoading}
          isEmpty={!isLoading && theaters.length === 0}
          onRetry={retry}
          isRetrying={isRetrying}
          emptyMessage={t('adminRooms.empty', 'No theaters found.')}
          skeleton={<AdminTableSkeleton rows={4} cols={3} />}
        >
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
              <div className="md:col-span-2 bg-surface-container-lowest p-6 border-none flex flex-col justify-between h-40">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-on-surface-variant">{t('adminRooms.totalCapacity', 'Total Global Capacity')}</div>
                <div className="mt-2">
                  <span className="text-4xl font-extrabold tracking-tighter text-on-surface">{totalCapacity.toLocaleString()}</span>
                  <span className="text-sm text-primary font-medium ml-2">+1.2% YoY</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-low mt-4 overflow-hidden rounded-full">
                  <div className="h-full bg-primary w-3/4"></div>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 h-40 flex flex-col justify-between">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-on-surface-variant">{t('adminRooms.activeTheaters', 'Active Theaters')}</div>
                <div className="text-3xl font-extrabold tracking-tighter text-on-surface">{theaters.length}</div>
                <div className="flex items-center gap-1 text-xs text-on-surface-variant">{t('adminRooms.acrossRegions', { count: new Set(theaters.map(t => t.region)).size, defaultValue: 'Across {{count}} Regions' })}</div>
              </div>
              <div className="bg-surface-container-lowest p-6 h-40 flex flex-col justify-between">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-on-surface-variant">{t('adminRooms.premiumScreens', 'Premium Screens')}</div>
                <div className="text-3xl font-extrabold tracking-tighter text-on-surface">
                  {theaters.flatMap(t => t.rooms).filter(r => ['IMAX', '4DX', 'VIP'].includes(r.level)).length}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-secondary-container text-primary text-[10px] font-bold rounded">IMAX / 4DX / VIP</span>
                </div>
              </div>
            </div>

            <div className="space-y-6 mt-10">
              {theaters.map((theater) => {
                const isExpanded = expandedTheaters[theater.id];
                return (
                  <section key={theater.id} className={`bg-surface-container-low p-1 transition-all ${!isExpanded ? 'opacity-70' : ''}`}>
                    <div className="flex items-center justify-between p-4 bg-surface-container-lowest border-b border-surface-container-low">
                      <div className="flex items-center gap-4">
                        <button onClick={() => toggleTheater(theater)} className="text-on-surface-variant">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <h3 className="font-bold text-on-surface">{theater.name}</h3>
                          <p className="text-xs text-on-surface-variant">{theater.region} • {t('adminRooms.roomsCount', { count: theater.rooms.length, defaultValue: '{{count}} Rooms' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleEditTheaterClick(theater)} className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">{t('adminRooms.editVenue', 'Edit Venue')}</button>
                        <div className="w-px h-4 bg-surface-container-high"></div>
                        <button onClick={() => handleDeleteTheaterClick(theater.id)} className="text-on-surface-variant hover:text-error transition-colors text-xs uppercase tracking-wider font-bold">{t('adminRooms.delete', 'Delete')}</button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="overflow-hidden">
                        {theater.rooms.length > 0 ? (
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-[0.7rem] uppercase tracking-widest text-on-surface-variant bg-surface-container-low/50">
                                <th className="px-10 py-3 font-semibold">{t('adminRooms.colRoomName', 'Room Name')}</th>
                                <th className="px-6 py-3 font-semibold text-center">{t('adminRooms.colCapacity', 'Capacity')}</th>
                                <th className="px-6 py-3 font-semibold">{t('adminRooms.colTechnology', 'Technology')}</th>
                                <th className="px-6 py-3 font-semibold">{t('adminRooms.colStatus', 'Status')}</th>
                                <th className="px-6 py-3 font-semibold">{t('adminRooms.colRentalRate', 'Rental Rate')}</th>
                                <th className="px-6 py-3 font-semibold text-right">{t('adminRooms.colActions', 'Actions')}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container-low">
                              {theater.rooms.map((room) => (
                                <tr key={room.id} className="bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
                                  <td className="px-10 py-4">
                                    <div className="font-medium text-on-surface">{room.name}</div>
                                    <div className="text-[10px] text-on-surface-variant">{room.level}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="font-mono text-on-surface-variant">{room.capacity}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-2 flex-wrap">
                                      {room.technologies.map((tech) => (
                                        <span
                                          key={tech}
                                          className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[9px] font-bold rounded uppercase"
                                        >
                                          {tech}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span
                                      className={`flex items-center gap-1.5 text-[11px] font-semibold ${room.status === 'operational' ? 'text-emerald-600' : 'text-amber-600'
                                        }`}
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 rounded-full ${room.status === 'operational' ? 'bg-emerald-500' : 'bg-amber-500'
                                          }`}
                                      ></span>
                                      {room.status === 'operational' ? t('adminRooms.statusOperational', 'Operational') : t('adminRooms.statusMaintenance', 'Maintenance')}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {roomRates[room.id] ? (
                                      <span className="font-semibold text-on-surface text-xs">
                                        {formatVND(roomRates[room.id])}/hr
                                      </span>
                                    ) : (
                                      <span className="text-xs text-on-surface-variant italic">
                                        {t('adminRooms.defaultRateLabel', 'Default / View')}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        type="button"
                                        className="px-3 h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider bg-surface-container-low text-primary hover:bg-surface-container rounded whitespace-nowrap transition-colors"
                                        onClick={() => handleOpenRateModal(room)}
                                      >
                                        {t('adminRooms.setRentalRate', 'Set Rental Rate')}
                                      </button>
                                      <button
                                        className="px-3 h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider bg-surface-container-low text-primary rounded whitespace-nowrap"
                                        onClick={() => navigate(`/admin/rooms/${room.id}/seats`)}
                                      >
                                        {t('adminRooms.configureSeats', 'Configure Seats')}
                                      </button>
                                      <button
                                        className="px-3 h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider bg-surface-container-low text-primary rounded whitespace-nowrap"
                                        onClick={() => handleEditRoomClick(theater, room)}
                                      >
                                        {t('adminRooms.edit', 'Edit')}
                                      </button>
                                      <button onClick={() => handleDeleteRoomClick(theater.id, room.id)} className="p-2 h-7 flex items-center justify-center hover:bg-error-container rounded text-on-surface-variant hover:text-error transition-colors">
                                        {t('adminRooms.delete', 'Delete')}
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-6 text-center text-sm text-on-surface-variant bg-surface-container-lowest">
                            {t('adminRooms.noRooms', 'No rooms configured yet.')}
                          </div>
                        )}
                        <div className="p-3 bg-surface-container-low/30 text-center">
                          <button onClick={() => handleAddRoomClick(theater)} className="text-[11px] font-bold text-primary hover:text-blue-900 uppercase tracking-widest flex items-center justify-center gap-2 w-full">
                            {t('adminRooms.addRoomTo', { theater: theater.name, defaultValue: 'Add Room to {{theater}}' })}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        </AdminDataState>
      </main>

      <TheaterModal
        isOpen={isTheaterModalOpen}
        onClose={() => setIsTheaterModalOpen(false)}
        onSubmit={handleTheaterSubmit}
        initialData={selectedTheater}
      />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        onSubmit={handleRoomSubmit}
        cinemaName={selectedTheaterForRoom?.name || ''}
        initialData={selectedRoom}
      />

      {/* Rental Rate Modal */}
      {isRateModalOpen && rateModalRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
            <div className="px-6 py-5 border-b border-surface-container flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-on-surface">
                  {t('adminRooms.setRateModalTitle', 'Set Room Rental Rate')}
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  {t('adminRooms.setRateModalSubtitle', 'Room: {{roomName}}', { roomName: rateModalRoom.name })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRateModalOpen(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRentalRate} className="p-6 space-y-4">
              {isFetchingRate && (
                <div className="flex items-center gap-2 text-xs text-primary mb-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('adminRooms.fetchingCurrentRate', 'Fetching current rate...')}</span>
                </div>
              )}

              {rateError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs">
                  {rateError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1.5">
                  {t('adminRooms.hourlyRateLabel', 'Base Hourly Rate (VND)')}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1000"
                    step="10000"
                    required
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                    className="w-full px-4 py-2.5 bg-surface-container-low border border-outline-variant/40 rounded-lg text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="150000"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-semibold text-on-surface-variant">
                    ₫/hr
                  </span>
                </div>
                {Number(rateInput) > 0 && (
                  <p className="text-xs text-on-surface-variant mt-1.5">
                    {t('adminRooms.previewRate', 'Preview: {{formatted}} per hour', {
                      formatted: formatVND(Number(rateInput)),
                    })}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container">
                <button
                  type="button"
                  onClick={() => setIsRateModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-on-surface-variant hover:bg-surface-container transition-colors"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSavingRate || isFetchingRate}
                  className="px-5 py-2 rounded-lg text-xs font-semibold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSavingRate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{t('common.saveChanges', 'Save Rate')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};
