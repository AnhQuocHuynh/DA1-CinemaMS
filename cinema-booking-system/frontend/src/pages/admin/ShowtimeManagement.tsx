import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, Search, Trash2, Wand2 } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { AutoShowtimeCreator } from '../../components/admin/AutoShowtimeCreator';
import { adminService } from '../../services/adminService';
import { showtimeService } from '../../services/showtimeService';
import { movieService } from '../../services/movieService';
import { eventService } from '../../services/eventService';
import { ShowtimeResponse } from '../../types/showtime';
import { formatShowtime, formatVND, parseVND } from '../../utils/formatters';
import genericPoster from '../../resources/generic_movie_poster.png';

// ── helper: flatten all rooms across all theaters ─────────────────────────────
interface FlatRoom { roomId: number; roomName: string; theaterName: string }

export const ShowtimeManagement: React.FC = () => {
  const [showtimes, setShowtimes] = useState<ShowtimeResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [showCreator, setShowCreator] = useState(false);
  const [flatRooms, setFlatRooms] = useState<FlatRoom[]>([]);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [expandedRooms, setExpandedRooms] = useState<Record<number, boolean>>({});
  const [roomDates, setRoomDates] = useState<Record<number, string>>({});

  const [movieMap, setMovieMap] = useState<Record<number, string>>({});
  const [eventMap, setEventMap] = useState<Record<number, string>>({});

  // ── Load all showtimes (all rooms across all theaters) ─────────────────────
  const loadAllShowtimes = useCallback(async () => {
    setIsLoading(true);
    try {
      const [theaters, movies, events] = await Promise.all([
        adminService.getTheaters(),
        movieService.getMovies(),
        eventService.getEvents()
      ]);

      const rooms: FlatRoom[] = [];
      theaters.forEach((t) =>
        t.rooms.forEach((r) =>
          rooms.push({ roomId: Number(r.id), roomName: r.name, theaterName: t.name }),
        ),
      );
      setFlatRooms(rooms);

      const mMap: Record<number, string> = {};
      movies.forEach(m => mMap[m.id] = m.title);
      setMovieMap(mMap);

      const eMap: Record<number, string> = {};
      events.forEach(e => eMap[e.id] = e.name);
      setEventMap(eMap);

      const allShowtimes = await Promise.all(
        rooms.map((r) => showtimeService.getShowtimesByRoom(r.roomId)),
      );
      const merged = allShowtimes.flat().sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
      );
      setShowtimes(merged);

      // Initialize first room as expanded if any
      if (rooms.length > 0) {
        setExpandedRooms({ [rooms[0].roomId]: true });
      }
    } catch (err) {
      console.error('Failed to load showtimes:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllShowtimes();
  }, [loadAllShowtimes]);

  // ── Delete handler ─────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this showtime? This action cannot be undone.')) return;
    setDeletingId(id);
    try {
      await showtimeService.deleteShowtime(id);
      setShowtimes((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Failed to delete showtime:', err);
      alert('Failed to delete. The showtime may have associated tickets.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleRoom = (roomId: number) => {
    setExpandedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  };

  const handleDateChange = (roomId: number, date: string) => {
    setRoomDates(prev => ({ ...prev, [roomId]: date }));
  };

  // ── Filter helper ──────────────────────────────────────────────────────────
  const matchesQuery = (st: ShowtimeResponse) => {
    if (!query) return true;
    const q = query.toLowerCase();
    const movieTitle = st.movieId ? movieMap[st.movieId] || `Movie #${st.movieId}` : '';
    const eventName = st.eventId ? eventMap[st.eventId] || `Event #${st.eventId}` : '';

    return (
      movieTitle.toLowerCase().includes(q) ||
      eventName.toLowerCase().includes(q) ||
      st.startTime.includes(q) ||
      st.status.toLowerCase().includes(q)
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const q = query.toLowerCase();

  const filteredRooms = flatRooms.filter((room) => {
    if (!query) return true;

    // Check if room name or theater name matches
    const roomLabel = `${room.theaterName} ${room.roomName}`.toLowerCase();
    if (roomLabel.includes(q)) return true;

    // Check if any showtime for the selected date matches the query
    const selectedDate = roomDates[room.roomId] || today;
    const roomShowtimes = showtimes.filter(st =>
      st.roomId === room.roomId &&
      st.startTime.startsWith(selectedDate)
    );

    return roomShowtimes.some(matchesQuery);
  });

  return (
    <AdminLayout activeItemId="showtimes">
      <AdminTopBar title="Admin Portal" searchPlaceholder="Search schedules..." />
      <main className="p-6 md:p-12 bg-surface min-h-screen">
        <AdminPageHeader
          title="Showtime Management"
          subtitle="Configure schedules and screen allocations for current movie runs."
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCreator(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm"
              >
                <Wand2 className="w-4 h-4" />
                Add Showtimes
              </button>
            </div>
          }
        />

        {/* Metrics strip */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-10 mb-12">
          <div className="md:col-span-2 bg-surface-container-lowest p-8 rounded-xl border border-transparent shadow-sm flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">
              Total Showtimes (loaded)
            </label>
            <div className="flex items-end justify-between">
              <span className="text-5xl font-bold tracking-tighter text-on-surface">
                {isLoading ? '…' : showtimes.length}
              </span>
            </div>
          </div>
          <div className="bg-surface-container-low p-8 rounded-xl flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">Scheduled</label>
            <span className="text-4xl font-bold tracking-tighter text-on-surface">
              {isLoading ? '…' : showtimes.filter((s) => s.status === 'SCHEDULED').length}
            </span>
          </div>
          <div className="bg-surface-container-high p-8 rounded-xl flex flex-col justify-between">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-secondary mb-4">Rooms</label>
            <span className="text-4xl font-bold tracking-tighter text-on-surface">
              {isLoading ? '…' : flatRooms.length}
            </span>
          </div>
        </section>

        {/* List of Rooms */}
        <section className="space-y-6">
          <div className="flex items-center gap-3 bg-surface-container-lowest px-4 py-3 rounded-xl border border-surface-container-low">
            <Search className="w-4 h-4 text-outline" />
            <input
              className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-outline"
              placeholder="Search by room name..."
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-on-surface-variant flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              <span>Loading schedules…</span>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-12 text-center text-on-surface-variant bg-surface-container-lowest rounded-xl">
              No rooms or showtimes match your search.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredRooms.map((room) => {
                const isExpanded = expandedRooms[room.roomId] || false;
                const selectedDate = roomDates[room.roomId] || today;

                const roomLabel = `${room.theaterName} ${room.roomName}`.toLowerCase();
                const isRoomMatch = query && roomLabel.includes(q);

                // filter showtimes for this room and date
                const roomShowtimes = showtimes.filter(st =>
                  st.roomId === room.roomId &&
                  st.startTime.startsWith(selectedDate)
                );

                const filteredRoomShowtimes = isRoomMatch ? roomShowtimes : roomShowtimes.filter(matchesQuery);

                return (
                  <div key={room.roomId} className="bg-surface-container-lowest border border-surface-container rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <div
                      className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-surface-container-low transition-colors"
                      onClick={() => toggleRoom(room.roomId)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-secondary">
                          {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                        <h3 className="font-bold text-on-surface text-lg">
                          {room.theaterName} <span className="text-secondary mx-1">›</span> {room.roomName}
                        </h3>
                        <span className="text-xs bg-surface-container-high px-2 py-1 rounded-md text-secondary font-medium">
                          {showtimes.filter(st => st.roomId === room.roomId).length} total
                        </span>
                      </div>

                      {/* Date picker */}
                      <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <label className="text-xs font-semibold text-secondary uppercase tracking-wider">Date</label>
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => handleDateChange(room.roomId, e.target.value)}
                          className="bg-surface border border-surface-container-high rounded-lg px-3 py-1.5 text-sm font-medium text-on-surface focus:outline-none focus:border-blue-400 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Content */}
                    {isExpanded && (
                      <div className="border-t border-surface-container bg-surface">
                        {filteredRoomShowtimes.length === 0 ? (
                          <div className="p-8 text-center text-secondary text-sm">
                            No showtimes found for <span className="font-semibold">{selectedDate}</span>.
                          </div>
                        ) : (
                          <table className="w-full text-left border-collapse">
                            <thead className="bg-surface-container-low/30">
                              <tr>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary">Movie / Event</th>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary">Start</th>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary">End</th>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary">Base Price</th>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary">Status</th>
                                <th className="px-8 py-3 text-[10px] uppercase tracking-widest font-bold text-secondary text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-surface-container/50">
                              {filteredRoomShowtimes.map((st) => (
                                <tr key={st.id} className="hover:bg-surface-container-lowest transition-colors">
                                  <td className="px-8 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-10 bg-slate-200 rounded overflow-hidden flex-shrink-0">
                                        <img
                                          src={genericPoster}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      <div>
                                        {st.movieId ? (
                                          <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">
                                            {movieMap[st.movieId] || `Movie #${st.movieId}`}
                                          </span>
                                        ) : st.eventId ? (
                                          <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">
                                            {eventMap[st.eventId] || `Event #${st.eventId}`}
                                          </span>
                                        ) : (
                                          <span className="text-xs text-slate-400">—</span>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-8 py-4 text-sm text-on-surface font-medium">{formatShowtime(st.startTime)}</td>
                                  <td className="px-8 py-4 text-sm text-secondary">{formatShowtime(st.endTime)}</td>
                                  <td className="px-8 py-4 text-sm text-on-surface">
                                    {formatVND(parseVND(st.basePrice))}
                                  </td>
                                  <td className="px-8 py-4">
                                    <span
                                      className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border
                                        ${st.status === 'SCHEDULED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                          st.status === 'ONGOING' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            st.status === 'CANCELLED' ? 'bg-red-50 text-red-600 border-red-200' :
                                              'bg-slate-100 text-slate-500 border-slate-200'}`}
                                    >
                                      {st.status}
                                    </span>
                                  </td>
                                  <td className="px-8 py-4 text-right">
                                    <button
                                      onClick={() => handleDelete(st.id)}
                                      disabled={deletingId === st.id}
                                      className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                                      title="Delete Showtime"
                                    >
                                      {deletingId === st.id ? (
                                        <Loader2 size={16} className="animate-spin" />
                                      ) : (
                                        <Trash2 size={16} />
                                      )}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Auto Showtime Creator modal */}
      {showCreator && (
        <AutoShowtimeCreator
          onClose={() => {
            setShowCreator(false);
            loadAllShowtimes(); // Refresh list after creator closes
          }}
        />
      )}
    </AdminLayout>
  );
};
