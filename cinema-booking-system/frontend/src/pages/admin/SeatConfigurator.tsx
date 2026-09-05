import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DndContext, DragOverlay, DragStartEvent, DragEndEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
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
    handleDragEnd: handleConfiguratorDragEnd,
    clearGrid,
    loadGrid,
    saveGrid,
    hasChanges,
  } = useSeatConfigurator(
    room?.theater.id?.toString(),
    roomId,
    room?.room.rows,
    room?.room.columns
  );

  React.useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [activeId, setActiveId] = useState<string | null>(null);
  const [showDiscardPopup, setShowDiscardPopup] = useState(false);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEndWrapper = (event: DragEndEvent) => {
    setActiveId(null);
    handleConfiguratorDragEnd(event);
  };

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
                onClick={() => {
                  if (hasChanges) {
                    setShowDiscardPopup(true);
                  } else {
                    navigate('/admin/rooms');
                  }
                }}
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
                disabled={isSaving || !hasChanges}
                className="bg-primary text-on-primary px-4 py-3 rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Configuration'}
              </button>
            </>
          }
        />

        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEndWrapper}>
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
                  <>
                    <SeatConfiguratorGrid
                      grid={grid}
                      columns={columns}
                      activeTool={activeTool}
                      onCellUpdate={handleCellUpdate}
                    />
                  </>
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

          <DragOverlay>
            {activeId ? (
              <div className={`w-8 h-8 rounded-sm border-2 border-white shadow-lg ${
                activeId === 'couple' ? 'bg-pink-500 aspect-[2/1] w-16' :
                activeId === 'vip' ? 'bg-amber-400' : 'bg-success'
              }`} />
            ) : null}
          </DragOverlay>
        </DndContext>

        {showDiscardPopup && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-surface-container-lowest w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-surface-container flex items-center justify-between bg-surface-container-low/50">
                <h2 className="text-xl font-bold text-on-surface">Unsaved Changes</h2>
                <button onClick={() => setShowDiscardPopup(false)} className="text-on-surface-variant hover:text-error p-1 rounded-md">✕</button>
              </div>
              <div className="p-6">
                <p className="text-sm text-on-surface-variant font-semibold">You have unsaved changes to the seat configuration. Are you sure you want to discard them and go back?</p>
              </div>
              <div className="px-6 py-4 border-t border-surface-container bg-surface-container-lowest flex justify-end gap-3">
                <button onClick={() => setShowDiscardPopup(false)} className="px-4 py-2 rounded-lg font-bold text-sm text-on-surface-variant hover:bg-surface-container">Cancel</button>
                <button onClick={() => navigate('/admin/rooms')} className="px-6 py-2 rounded-lg font-bold text-sm bg-error text-on-error hover:opacity-90">
                  Discard Changes
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </AdminLayout>
  );
};
