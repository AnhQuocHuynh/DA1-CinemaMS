import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminRooms } from '../../hooks/useAdminRooms';
import { AdminTheater } from '../../types/admin';
import { TheaterModal } from '../../components/admin/modals/TheaterModal';
import { RoomModal } from '../../components/admin/modals/RoomModal';

export const RoomManagement: React.FC = () => {
  const navigate = useNavigate();
  const { theaters, isLoading, addTheater, updateTheater, deleteTheater, addRoom, updateRoom, deleteRoom } = useAdminRooms();

  const [expandedTheaters, setExpandedTheaters] = useState<Record<string, boolean>>({
    'theater-1': true,
  });

  // Modal States
  const [isTheaterModalOpen, setIsTheaterModalOpen] = useState(false);
  const [selectedTheater, setSelectedTheater] = useState<any>(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedTheaterForRoom, setSelectedTheaterForRoom] = useState<{ id: string; name: string } | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

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
    if (window.confirm('Are you sure you want to delete this theater? All rooms will also be deleted.')) {
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
    if (window.confirm('Are you sure you want to delete this room?')) {
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

  const totalCapacity = theaters.reduce((acc, theater) =>
    acc + theater.rooms.reduce((roomAcc, room) => roomAcc + (room.capacity || 0), 0), 0
  );

  return (
    <AdminLayout activeItemId="rooms">
      <AdminTopBar title="The Digital Architect" searchPlaceholder="Search theaters or rooms..." />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          title="Theaters & Rooms"
          subtitle="Manage global venue infrastructure and technology specifications."
          actions={
            <button onClick={handleAddTheaterClick} className="bg-primary text-on-primary px-6 py-2.5 rounded hover:brightness-110 transition-all flex items-center gap-2 font-semibold text-sm">
              <Plus className="w-4 h-4" />
              Add New Theater
            </button>
          }
        />

        {isLoading ? (
          <div className="text-center py-16 text-on-surface-variant">Loading theaters...</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-12">
              <div className="md:col-span-2 bg-surface-container-lowest p-6 border-none flex flex-col justify-between h-40">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-slate-500">Total Global Capacity</div>
                <div className="mt-2">
                  <span className="text-4xl font-extrabold tracking-tighter text-slate-900">{totalCapacity.toLocaleString()}</span>
                  <span className="text-sm text-blue-600 font-medium ml-2">+1.2% YoY</span>
                </div>
                <div className="h-1.5 w-full bg-surface-container-low mt-4 overflow-hidden rounded-full">
                  <div className="h-full bg-primary w-3/4"></div>
                </div>
              </div>
              <div className="bg-surface-container-lowest p-6 h-40 flex flex-col justify-between">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-slate-500">Active Theaters</div>
                <div className="text-3xl font-extrabold tracking-tighter text-slate-900">{theaters.length}</div>
                <div className="flex items-center gap-1 text-xs text-slate-400">Across {new Set(theaters.map(t => t.region)).size} Regions</div>
              </div>
              <div className="bg-surface-container-lowest p-6 h-40 flex flex-col justify-between">
                <div className="text-[0.75rem] font-medium uppercase tracking-widest text-slate-500">Premium Screens</div>
                <div className="text-3xl font-extrabold tracking-tighter text-slate-900">
                  {theaters.flatMap(t => t.rooms).filter(r => ['IMAX', '4DX', 'VIP'].includes(r.level)).length}
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">IMAX / 4DX / VIP</span>
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
                        <button onClick={() => toggleTheater(theater)} className="text-slate-400">
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <div>
                          <h3 className="font-bold text-slate-900">{theater.name}</h3>
                          <p className="text-xs text-slate-500">{theater.region} • {theater.rooms.length} Rooms</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => handleEditTheaterClick(theater)} className="text-primary text-xs font-bold uppercase tracking-wider hover:underline">Edit Venue</button>
                        <div className="w-px h-4 bg-slate-200"></div>
                        <button onClick={() => handleDeleteTheaterClick(theater.id)} className="text-slate-400 hover:text-error transition-colors text-xs uppercase tracking-wider font-bold">Delete</button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="overflow-hidden">
                        {theater.rooms.length > 0 ? (
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="text-[0.7rem] uppercase tracking-widest text-slate-400 bg-surface-container-low/50">
                                <th className="px-10 py-3 font-semibold">Room Name</th>
                                <th className="px-6 py-3 font-semibold text-center">Capacity</th>
                                <th className="px-6 py-3 font-semibold">Technology</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3 font-semibold text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container-low">
                              {theater.rooms.map((room) => (
                                <tr key={room.id} className="bg-surface-container-lowest hover:bg-slate-50 transition-colors">
                                  <td className="px-10 py-4">
                                    <div className="font-medium text-slate-900">{room.name}</div>
                                    <div className="text-[10px] text-slate-400">{room.level}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center">
                                    <span className="font-mono text-slate-700">{room.capacity}</span>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-2 flex-wrap">
                                      {room.technologies.map((tech) => (
                                        <span
                                          key={tech}
                                          className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[9px] font-bold rounded uppercase"
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
                                      {room.status === 'operational' ? 'Operational' : 'Maintenance'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        className="px-3 h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider bg-surface-container-low text-primary rounded whitespace-nowrap"
                                        onClick={() => navigate(`/admin/rooms/${room.id}/seats`)}
                                      >
                                        Configure Seats
                                      </button>
                                      <button
                                        className="px-3 h-7 flex items-center justify-center text-[10px] font-bold uppercase tracking-wider bg-surface-container-low text-primary rounded whitespace-nowrap"
                                        onClick={() => handleEditRoomClick(theater, room)}
                                      >
                                        Edit
                                      </button>
                                      <button onClick={() => handleDeleteRoomClick(theater.id, room.id)} className="p-2 h-7 flex items-center justify-center hover:bg-red-50 rounded text-slate-400 hover:text-error transition-colors">
                                        Delete
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-6 text-center text-sm text-slate-500 bg-surface-container-lowest">
                            No rooms configured yet.
                          </div>
                        )}
                        <div className="p-3 bg-surface-container-low/30 text-center">
                          <button onClick={() => handleAddRoomClick(theater)} className="text-[11px] font-bold text-blue-700 hover:text-blue-900 uppercase tracking-widest flex items-center justify-center gap-2 w-full">
                            Add Room to {theater.name}
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          </>
        )}
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
    </AdminLayout>
  );
};
