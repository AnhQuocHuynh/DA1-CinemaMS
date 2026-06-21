import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { SeatConfiguratorGrid } from '../../components/admin/SeatConfiguratorGrid';
import { SeatConfiguratorSidebar } from '../../components/admin/SeatConfiguratorSidebar';
import { useAdminRooms } from '../../hooks/useAdminRooms';
import { useSeatConfigurator } from '../../hooks/useSeatConfigurator';

export const SeatConfigurator: React.FC = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { theaters } = useAdminRooms();

  const room = useMemo(() => {
    for (const theater of theaters) {
      const match = theater.rooms.find((item) => item.id === roomId);
      if (match) {
        return { theater, room: match };
      }
    }
    return null;
  }, [theaters, roomId]);

  const {
    rows,
    columns,
    activeTool,
    grid,
    seatCounts,
    isLoading,
    isSaving,
    setActiveTool,
    updateGridSize,
    handleCellUpdate,
    handleDrop,
    handleDragOver,
    clearGrid,
    loadGrid,
    saveGrid,
  } = useSeatConfigurator(
    room?.theater.id?.toString(),
    roomId,
    room?.room.rows,
    room?.room.columns
  );

  React.useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const roomName = room?.room.name ?? (roomId ? `Room ${roomId}` : 'Room');

  return (
    <AdminLayout activeItemId="rooms">
      <AdminTopBar
        title="Seat Configuration"
        searchPlaceholder="Search halls or templates..."
        navLinks={[
          { label: 'Rooms', to: '/admin/rooms' },
          { label: 'Schedules', to: '/admin/showtimes' },
          { label: 'Reports', to: '/admin/permissions' },
        ]}
      />

      <main className="p-6 md:p-10 bg-surface min-h-screen">
        <AdminPageHeader
          eyebrow={room?.theater.name ?? 'Hall Template'}
          title={roomName}
          subtitle="Drag a seat type onto the map or click to paint. Click the same seat to clear it."
          actions={
            <>
              <button
                className="bg-surface-container-low px-4 py-3 rounded-lg text-sm font-semibold"
                onClick={() => navigate('/admin/rooms')}
              >
                Back to Rooms
              </button>
              <button
                className="bg-surface-container-low px-4 py-3 rounded-lg text-sm font-semibold"
                onClick={clearGrid}
              >
                Reset Grid
              </button>
              <button 
                onClick={saveGrid}
                disabled={isSaving}
                className="bg-primary text-on-primary px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </>
          }
        />

        <div className="mt-10 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-10">
          <section className="bg-surface-container-lowest rounded-2xl p-8 border border-outline-variant/10">
            <div className="flex flex-col items-center mb-12">
              <div className="w-full max-w-2xl bg-surface-container-highest/30 h-12 rounded-t-[100%] flex items-center justify-center relative">
                <div className="absolute bottom-0 w-4/5 h-1 bg-gradient-to-r from-transparent via-primary to-transparent blur-[1px]"></div>
              </div>
              <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-outline mt-4">Screen</span>
            </div>

            <div className="perspective-container">
              <div className="perspective-map">
                {isLoading ? (
                  <div className="flex justify-center items-center h-64 text-outline">Loading seat map...</div>
                ) : (
                  <SeatConfiguratorGrid
                    grid={grid}
                    columns={columns}
                    activeTool={activeTool}
                    onCellUpdate={handleCellUpdate}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  />
                )}
              </div>
            </div>

            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-surface-container-low p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-outline">Standard Seats</div>
                <div className="text-2xl font-bold text-on-surface mt-2">{seatCounts.standard}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-outline">VIP Seats</div>
                <div className="text-2xl font-bold text-on-surface mt-2">{seatCounts.vip}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-outline">Couple Seats</div>
                <div className="text-2xl font-bold text-on-surface mt-2">{seatCounts.couple}</div>
              </div>
              <div className="bg-surface-container-low p-4 rounded-xl">
                <div className="text-[10px] uppercase tracking-widest text-outline">Total Capacity</div>
                <div className="text-2xl font-bold text-on-surface mt-2">{seatCounts.total}</div>
              </div>
            </div>
          </section>

          <SeatConfiguratorSidebar
            activeTool={activeTool}
            rows={rows}
            columns={columns}
            onToolChange={setActiveTool}
            onRowsChange={(value) => updateGridSize(value, columns)}
            onColumnsChange={(value) => updateGridSize(rows, value)}
          />
        </div>
      </main>
    </AdminLayout>
  );
};
