import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { 
  Building2, 
  Calendar, 
  Clock, 
  Film, 
  CheckCircle2, 
  AlertCircle, 
  Info, 
  Sparkles, 
  Users, 
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  Tv,
  Check,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { SiteTopNav } from '../../components/SiteTopNav';
import { useAuthStore } from '../../store/authStore';
import { useToast } from '../../contexts/ToastContext';
import { cinemaService, CinemaResponse, CinemaRoomResponse } from '../../services/cinemaService';
import { movieService, MovieResponse } from '../../services/movieService';
import { rentalService } from '../../services/rentalService';
import { RoomAvailability, RentalQuote } from '../../types/rental';
import { formatVND } from '../../utils/formatters';
import { isWeekendWindow, overlapsPeakHours, getUnavailableReasonMessage } from '../../utils/rentalUtils';

const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00'
];

const DURATION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIMELINE_START_HOUR = 8;
const TIMELINE_END_HOUR = 24;
const TIMELINE_TOTAL_MINUTES = (TIMELINE_END_HOUR - TIMELINE_START_HOUR) * 60; // 960 min

export const RoomRentalBooking: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { addToast } = useToast();

  // Cinema & Rooms State
  const [cinemas, setCinemas] = useState<CinemaResponse[]>([]);
  const [selectedCinemaId, setSelectedCinemaId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<CinemaRoomResponse[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [isLoadingCinemas, setIsLoadingCinemas] = useState(true);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

  // Date & Time State
  const tomorrowStr = useMemo(() => dayjs().add(1, 'day').format('YYYY-MM-DD'), []);
  const todayStr = useMemo(() => dayjs().format('YYYY-MM-DD'), []);
  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);
  const [startTime, setStartTime] = useState<string>('14:00');
  const [durationHours, setDurationHours] = useState<number>(2);

  // Optional Movie State
  const [movies, setMovies] = useState<MovieResponse[]>([]);
  const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null);
  const [isLoadingMovies, setIsLoadingMovies] = useState(false);

  // Availability & Quote State
  const [availability, setAvailability] = useState<RoomAvailability | null>(null);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [quote, setQuote] = useState<RentalQuote | null>(null);
  const [isQuoting, setIsQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Submit State
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Compute ISO timestamps
  const startTimeISO = useMemo(() => `${selectedDate}T${startTime}:00`, [selectedDate, startTime]);
  const endTimeISO = useMemo(() => {
    return dayjs(startTimeISO).add(durationHours, 'hour').format('YYYY-MM-DDTHH:mm:ss');
  }, [startTimeISO, durationHours]);

  const isStartInFuture = useMemo(() => {
    return dayjs(startTimeISO).isAfter(dayjs());
  }, [startTimeISO]);

  // Selected Movie validation
  const selectedMovie = useMemo(() => {
    if (!selectedMovieId) return null;
    return movies.find((m) => m.id === selectedMovieId) || null;
  }, [selectedMovieId, movies]);

  const isMovieTooLong = useMemo(() => {
    if (!selectedMovie) return false;
    return durationHours * 60 < selectedMovie.durationMinutes + 15;
  }, [selectedMovie, durationHours]);

  // Selected Room Object
  const selectedRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  // 1. Initial Load: Cinemas & Movies
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      setIsLoadingCinemas(true);
      setIsLoadingMovies(true);
      try {
        const [cinemaList, movieList] = await Promise.all([
          cinemaService.getCinemas().catch(() => []),
          movieService.getMovies().catch(() => []),
        ]);

        if (!isMounted) return;

        setCinemas(cinemaList);
        setMovies(movieList.filter((m) => m.active));

        // Auto-select cinema from query param or first active cinema
        const paramId = searchParams.get('cinemaId');
        const activeCinemas = cinemaList.filter((c) => c.active);
        let defaultCinemaId: number | null = null;

        if (paramId) {
          const match = cinemaList.find((c) => c.id === Number(paramId));
          if (match) defaultCinemaId = match.id;
        }

        if (!defaultCinemaId && activeCinemas.length > 0) {
          defaultCinemaId = activeCinemas[0].id;
        } else if (!defaultCinemaId && cinemaList.length > 0) {
          defaultCinemaId = cinemaList[0].id;
        }

        setSelectedCinemaId(defaultCinemaId);
      } catch (err) {
        console.error('Failed to load initial rental data:', err);
      } finally {
        if (isMounted) {
          setIsLoadingCinemas(false);
          setIsLoadingMovies(false);
        }
      }
    };

    fetchInitialData();
    return () => {
      isMounted = false;
    };
  }, [searchParams]);

  // 2. Fetch Rooms when Selected Cinema changes
  useEffect(() => {
    if (!selectedCinemaId) {
      setRooms([]);
      setSelectedRoomId(null);
      return;
    }

    let isMounted = true;
    const fetchRooms = async () => {
      setIsLoadingRooms(true);
      try {
        const roomList = await cinemaService.getRoomsByCinema(selectedCinemaId);
        if (!isMounted) return;

        setRooms(roomList);
        // Auto select first active and non-maintenance room if current selectedRoomId not valid
        const availableRooms = roomList.filter((r) => r.active && !r.underMaintenance);
        if (availableRooms.length > 0) {
          setSelectedRoomId((prev) => {
            const stillValid = roomList.some((r) => r.id === prev && r.active && !r.underMaintenance);
            return stillValid ? prev : availableRooms[0].id;
          });
        } else {
          setSelectedRoomId(null);
        }
      } catch (err) {
        console.error('Failed to load rooms for cinema:', err);
        if (isMounted) setRooms([]);
      } finally {
        if (isMounted) setIsLoadingRooms(false);
      }
    };

    fetchRooms();
    return () => {
      isMounted = false;
    };
  }, [selectedCinemaId]);

  // 3. Fetch Room Availability whenever room and date are set
  useEffect(() => {
    if (!selectedRoomId || !selectedDate) {
      setAvailability(null);
      return;
    }

    let isMounted = true;
    const fetchAvailability = async () => {
      setIsLoadingAvailability(true);
      try {
        const from = `${selectedDate}T00:00:00`;
        const to = `${selectedDate}T23:59:59`;
        const data = await rentalService.getRoomAvailability(selectedRoomId, from, to);
        if (isMounted) {
          setAvailability(data);
        }
      } catch (err) {
        console.error('Failed to load room availability:', err);
        if (isMounted) setAvailability(null);
      } finally {
        if (isMounted) setIsLoadingAvailability(false);
      }
    };

    fetchAvailability();
    return () => {
      isMounted = false;
    };
  }, [selectedRoomId, selectedDate]);

  // 4. Fetch Live Price Quote (with race condition protection)
  useEffect(() => {
    if (!selectedRoomId || !isStartInFuture) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    let isCancelled = false;
    const fetchQuote = async () => {
      setIsQuoting(true);
      setQuoteError(null);
      try {
        const result = await rentalService.quote({
          roomId: selectedRoomId,
          movieId: selectedMovieId || null,
          startTime: startTimeISO,
          endTime: endTimeISO,
        });

        if (!isCancelled) {
          setQuote(result);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          const e = err as { response?: { data?: { message?: string } }; message?: string };
          setQuoteError(e.response?.data?.message || e.message || 'Unable to calculate price quote');
          setQuote(null);
        }
      } finally {
        if (!isCancelled) {
          setIsQuoting(false);
        }
      }
    };

    fetchQuote();
    return () => {
      isCancelled = true;
    };
  }, [selectedRoomId, startTimeISO, endTimeISO, selectedMovieId, isStartInFuture]);

  // Handle Form Submission
  const handleSubmitRental = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (!selectedRoomId || !quote?.available || !isStartInFuture || isMovieTooLong) {
      return;
    }

    setIsSubmitting(true);
    try {
      await rentalService.create({
        roomId: selectedRoomId,
        movieId: selectedMovieId || null,
        startTime: startTimeISO,
        endTime: endTimeISO,
      });

      addToast(
        t('roomRental.successToast', 'Room rental request submitted successfully! Our staff will review your request shortly.'),
        'success'
      );
      navigate('/my-tickets?tab=rentals');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = e.response?.data?.message || e.message || t('roomRental.submitError', 'Failed to submit rental request. Please try again.');
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timeline Hour Marks: [08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00, 22:00, 24:00]
  const timelineHourMarks = useMemo(() => {
    return [8, 10, 12, 14, 16, 18, 20, 22, 24].map((hour) => {
      const offsetMinutes = (hour - TIMELINE_START_HOUR) * 60;
      const leftPct = (offsetMinutes / TIMELINE_TOTAL_MINUTES) * 100;
      const label = `${String(hour).padStart(2, '0')}:00`;
      return { hour, leftPct, label };
    });
  }, []);

  // Compute selected window block for visual timeline (clamped to 08:00 - 24:00)
  const selectedWindowTimelineBlock = useMemo(() => {
    const selStart = dayjs(startTimeISO);
    const selEnd = dayjs(endTimeISO);
    const dayStart = dayjs(`${selectedDate}T08:00:00`);
    const dayEnd = dayjs(`${selectedDate}T23:59:59`);

    if (selEnd.isBefore(dayStart) || selStart.isAfter(dayEnd)) {
      return null;
    }

    const startDiff = Math.max(0, selStart.diff(dayStart, 'minute'));
    const endDiff = Math.min(TIMELINE_TOTAL_MINUTES, selEnd.diff(dayStart, 'minute'));

    if (endDiff <= startDiff) return null;

    const leftPct = (startDiff / TIMELINE_TOTAL_MINUTES) * 100;
    const widthPct = ((endDiff - startDiff) / TIMELINE_TOTAL_MINUTES) * 100;

    return {
      leftPct,
      widthPct,
      startTimeStr: selStart.format('HH:mm'),
      endTimeStr: selEnd.format('HH:mm'),
    };
  }, [startTimeISO, endTimeISO, selectedDate]);

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <SiteTopNav activeLabel="Room Rental" showSearch={false} />

      <main className="pt-24 px-4 sm:px-8 pb-20">
        <div className="max-w-6xl mx-auto space-y-10">

          {/* Page Header */}
          <section className="border-b border-outline-variant/20 pb-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  {t('roomRental.badge', 'VIP Private Screening')}
                </div>
                <h1 className="text-3xl sm:text-4xl font-extrabold text-on-surface tracking-tight">
                  {t('roomRental.title', 'Private Screening Room Rental')}
                </h1>
                <p className="text-on-surface-variant text-sm sm:text-base mt-1.5 max-w-2xl">
                  {t(
                    'roomRental.subtitle',
                    'Rent an entire cinema auditorium for birthdays, presentations, private movie nights, gaming tournaments, and VIP events.'
                  )}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/my-tickets?tab=rentals')}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-outline-variant/40 hover:bg-surface-container transition-colors inline-flex items-center gap-2"
                >
                  <Film className="w-3.5 h-3.5 text-primary" />
                  {t('roomRental.viewMyRentals', 'My Rentals')}
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </section>

          {/* Main Booking Content */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Column: Step 1 & Step 2 */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-8">

              {/* STEP 1: Select Cinema Branch & Screening Room */}
              <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    1
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">
                      {t('roomRental.step1Title', 'Select Cinema Branch & Screening Room')}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      {t('roomRental.step1Subtitle', 'Choose the location and auditorium format for your rental.')}
                    </p>
                  </div>
                </div>

                {/* Cinema Branch Selector */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    {t('roomRental.selectCinemaLabel', 'Cinema Branch')}
                  </label>

                  {isLoadingCinemas ? (
                    <div className="h-12 rounded-xl bg-surface-container animate-pulse flex items-center px-4 text-xs text-on-surface-variant">
                      {t('roomRental.loadingCinemas', 'Loading cinemas...')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {cinemas.map((cinema) => {
                        const isSelected = selectedCinemaId === cinema.id;
                        return (
                          <button
                            key={cinema.id}
                            type="button"
                            disabled={!cinema.active}
                            onClick={() => setSelectedCinemaId(cinema.id)}
                            className={`p-3 rounded-xl border text-left transition-all relative ${
                              !cinema.active
                                ? 'opacity-40 cursor-not-allowed border-outline-variant/20 bg-surface-container'
                                : isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs'
                                : 'border-outline-variant/30 hover:border-primary/40 bg-surface-container-lowest'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <p className="text-xs font-bold text-on-surface truncate">{cinema.name}</p>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                              {cinema.city || cinema.address}
                            </p>
                            {!cinema.active && (
                              <span className="inline-block mt-1 text-[9px] uppercase font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">
                                {t('roomRental.inactive', 'Inactive')}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rooms Grid */}
                <div className="space-y-2.5 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-2">
                      <Tv className="w-4 h-4 text-primary" />
                      {t('roomRental.selectRoomLabel', 'Auditorium / Screening Room')}
                    </label>
                    <span className="text-[11px] text-on-surface-variant">
                      {rooms.length} {t('roomRental.roomsAvailable', 'rooms available')}
                    </span>
                  </div>

                  {isLoadingRooms ? (
                    <div className="h-28 rounded-xl bg-surface-container animate-pulse flex items-center justify-center text-xs text-on-surface-variant">
                      {t('roomRental.loadingRooms', 'Loading screening rooms...')}
                    </div>
                  ) : rooms.length === 0 ? (
                    <div className="p-6 rounded-xl border border-dashed border-outline-variant/40 text-center text-xs text-on-surface-variant">
                      {t('roomRental.noRooms', 'No screening rooms available for this cinema.')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {rooms.map((room) => {
                        const isSelected = selectedRoomId === room.id;
                        const isUnavailable = !room.active || room.underMaintenance;
                        const capacity = room.totalSeats || ((room.rows || 0) * (room.columns || 0)) || 'Standard';
                        const formatBadge = room.type || 'Standard';

                        return (
                          <button
                            key={room.id}
                            type="button"
                            disabled={isUnavailable}
                            onClick={() => setSelectedRoomId(room.id)}
                            className={`p-4 rounded-xl border text-left transition-all relative ${
                              isUnavailable
                                ? 'opacity-50 cursor-not-allowed bg-surface-container border-outline-variant/30'
                                : isSelected
                                ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-sm'
                                : 'border-outline-variant/30 hover:border-primary/50 bg-surface-container-lowest'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-bold text-sm text-on-surface">{room.name}</h3>
                              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                                {formatBadge}
                              </span>
                            </div>

                            <div className="flex items-center gap-4 mt-2.5 text-xs text-on-surface-variant">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Users className="w-3.5 h-3.5 text-primary" />
                                {capacity} {t('roomRental.seats', 'seats')}
                              </span>

                              {isUnavailable ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
                                  <ShieldAlert className="w-3 h-3" />
                                  {room.underMaintenance
                                    ? t('roomRental.maintenance', 'Maintenance')
                                    : t('roomRental.inactive', 'Inactive')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {t('roomRental.operational', 'Operational')}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              {/* STEP 2: Date, Time Window, Visual Timeline & Movie */}
              <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-3 border-b border-outline-variant/20 pb-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                    2
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-on-surface">
                      {t('roomRental.step2Title', 'Select Date, Time Window & Movie')}
                    </h2>
                    <p className="text-xs text-on-surface-variant">
                      {t('roomRental.step2Subtitle', 'Inspect live schedule availability and reserve your rental window.')}
                    </p>
                  </div>
                </div>

                {/* Date Picker & Time Controls */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Date Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" />
                      {t('roomRental.rentalDate', 'Rental Date')}
                    </label>
                    <input
                      type="date"
                      value={selectedDate}
                      min={todayStr}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                    />
                  </div>

                  {/* Start Time Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {t('roomRental.startTime', 'Start Time')}
                    </label>
                    <select
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                    >
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Duration Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {t('roomRental.duration', 'Duration (Hours)')}
                    </label>
                    <select
                      value={durationHours}
                      onChange={(e) => setDurationHours(Number(e.target.value))}
                      className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-semibold focus:outline-none focus:border-primary"
                    >
                      {DURATION_OPTIONS.map((hours) => (
                        <option key={hours} value={hours}>
                          {hours} {hours === 1 ? t('roomRental.hour', 'hour') : t('roomRental.hours', 'hours')} ({hours * 60} min)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Inline Future Time Validation */}
                {!isStartInFuture && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-xl text-xs font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>
                      {t('roomRental.pastTimeWarning', 'The selected start time is in the past. Please select a future date or time.')}
                    </span>
                  </div>
                )}

                {/* VISUAL AVAILABILITY TIMELINE */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                        {t('roomRental.availabilityTimeline', 'Daily Room Availability (08:00 – 24:00)')}
                      </span>
                      {isLoadingAvailability && (
                        <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      )}
                    </div>

                    {availability?.pricePerHour != null && availability.pricePerHour > 0 && (
                      <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                        {t('roomRental.baseRate', 'Base Rate')}: {formatVND(availability.pricePerHour)}/hr
                      </span>
                    )}
                  </div>

                  {/* Timeline Bar Container */}
                  <div className="bg-surface-container-low/70 border border-outline-variant/40 rounded-xl p-4 space-y-4">
                    <div className="relative pt-6 pb-2">
                      {/* The 08:00 - 24:00 background bar */}
                      <div className="relative h-10 w-full bg-surface-container rounded-lg overflow-hidden border border-outline-variant/30">
                        {/* Hour vertical grid guides */}
                        {timelineHourMarks.map((mark) => (
                          <div
                            key={mark.hour}
                            style={{ left: `${mark.leftPct}%` }}
                            className="absolute top-0 bottom-0 w-px bg-outline-variant/30 pointer-events-none"
                          />
                        ))}

                        {/* Busy Slots */}
                        {availability?.busy && availability.busy.map((slot, idx) => {
                          const slotStart = dayjs(slot.startTime);
                          const slotEnd = dayjs(slot.endTime);
                          const dayStart = dayjs(`${selectedDate}T08:00:00`);
                          const dayEnd = dayjs(`${selectedDate}T23:59:59`);

                          if (slotEnd.isBefore(dayStart) || slotStart.isAfter(dayEnd)) {
                            return null;
                          }

                          const startDiff = Math.max(0, slotStart.diff(dayStart, 'minute'));
                          const endDiff = Math.min(TIMELINE_TOTAL_MINUTES, slotEnd.diff(dayStart, 'minute'));
                          if (endDiff <= startDiff) return null;

                          const leftPct = (startDiff / TIMELINE_TOTAL_MINUTES) * 100;
                          const widthPct = Math.max(0.6, ((endDiff - startDiff) / TIMELINE_TOTAL_MINUTES) * 100);

                          const isShowtime = String(slot.source).toUpperCase() === 'SHOWTIME';

                          return (
                            <div
                              key={`${slot.source}-${idx}-${slot.startTime}`}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              title={`${isShowtime ? 'Showtime' : 'Rental'}: ${slotStart.format('HH:mm')} - ${slotEnd.format('HH:mm')}`}
                              className={`absolute top-1 bottom-1 rounded z-5 flex items-center justify-center transition-all ${
                                isShowtime ? 'bg-sky-500/80' : 'bg-amber-500/85'
                              }`}
                            >
                              <span className="text-[9px] font-bold text-white uppercase px-1 truncate pointer-events-none">
                                {isShowtime ? 'Show' : 'Rental'}
                              </span>
                            </div>
                          );
                        })}

                        {/* Customer's current selection highlight */}
                        {selectedWindowTimelineBlock && (
                          <div
                            style={{
                              left: `${selectedWindowTimelineBlock.leftPct}%`,
                              width: `${selectedWindowTimelineBlock.widthPct}%`,
                            }}
                            className="absolute top-0 bottom-0 bg-primary/25 border-2 border-primary border-dashed rounded-lg z-10 pointer-events-none flex items-center justify-center"
                          >
                            <span className="text-[10px] font-black text-primary bg-surface/90 px-1.5 py-0.5 rounded shadow-2xs truncate">
                              {selectedWindowTimelineBlock.startTimeStr}–{selectedWindowTimelineBlock.endTimeStr}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Hour labels below bar */}
                      <div className="relative h-5 w-full mt-1.5">
                        {timelineHourMarks.map((mark) => (
                          <span
                            key={mark.hour}
                            style={{ left: `${mark.leftPct}%` }}
                            className="absolute -translate-x-1/2 text-[10px] font-mono text-on-surface-variant select-none"
                          >
                            {mark.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Timeline Legend & Note */}
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] pt-1 border-t border-outline-variant/20 text-on-surface-variant">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-sky-500/80 inline-block" />
                          {t('roomRental.showtimeOccupied', 'Scheduled Showtime')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded bg-amber-500/85 inline-block" />
                          {t('roomRental.rentalOccupied', 'Reserved Rental')}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-3 h-3 rounded border border-dashed border-primary bg-primary/20 inline-block" />
                          {t('roomRental.yourSelection', 'Your Window')}
                        </span>
                      </div>

                      <span className="text-[10px] italic text-on-surface-variant/80">
                        * {t('roomRental.bufferNote', 'Includes mandatory 15-min cleaning/turnover buffer between sessions.')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* OPTIONAL PRIVATE MOVIE SCREENING */}
                <div className="space-y-2 pt-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
                    <Film className="w-3.5 h-3.5 text-primary" />
                    {t('roomRental.movieOptionLabel', 'Optional: Private Movie Screening')}
                  </label>
                  <p className="text-[11px] text-on-surface-variant">
                    {t(
                      'roomRental.movieOptionDesc',
                      'Leave empty if you are hosting a presentation, gaming party, or bring-your-own private content.'
                    )}
                  </p>

                  <select
                    value={selectedMovieId ?? ''}
                    disabled={isLoadingMovies}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedMovieId(val ? Number(val) : null);
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-outline-variant/40 bg-surface text-on-surface text-xs font-medium focus:outline-none focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {isLoadingMovies
                        ? t('roomRental.loadingMovies', 'Loading movies...')
                        : t('roomRental.noMovieOption', 'None — Private Event / Presentation / Gaming / Personal Media')}
                    </option>
                    {movies.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title} ({m.durationMinutes} min)
                      </option>
                    ))}
                  </select>

                  {/* Movie runtime warning if duration is too short */}
                  {isMovieTooLong && selectedMovie && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 rounded-xl text-xs animate-fade-in">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <div>
                        <p className="font-semibold">
                          {t('roomRental.movieDurationWarningTitle', 'Rental Duration Too Short for Selected Movie')}
                        </p>
                        <p className="mt-0.5 text-[11px]">
                          {t(
                            'roomRental.movieDurationWarningBody',
                            'The selected movie runtime is {{runtime}} min plus a 15-min cleaning buffer ({{total}} min needed). Your selected duration is {{duration}} hours ({{durationMin}} min). Please increase duration to at least {{recommended}} hours.',
                            {
                              runtime: selectedMovie.durationMinutes,
                              total: selectedMovie.durationMinutes + 15,
                              duration: durationHours,
                              durationMin: durationHours * 60,
                              recommended: Math.ceil((selectedMovie.durationMinutes + 15) / 60),
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: Step 3 - Live Price Quote & Submission */}
            <div className="lg:col-span-5 xl:col-span-4 sticky top-24 space-y-6">
              <section className="bg-surface-container-lowest rounded-2xl border border-outline-variant/40 p-6 shadow-md space-y-6">
                <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      3
                    </div>
                    <h2 className="text-base font-bold text-on-surface">
                      {t('roomRental.step3Title', 'Live Price Quote')}
                    </h2>
                  </div>

                  {isQuoting && (
                    <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      {t('roomRental.calculating', 'Calculating...')}
                    </div>
                  )}
                </div>

                {/* Selected Window Summary */}
                <div className="bg-surface-container-low/70 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>{t('roomRental.summaryRoom', 'Room')}</span>
                    <span className="font-bold text-on-surface">
                      {selectedRoom ? selectedRoom.name : '—'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>{t('roomRental.summaryDate', 'Date')}</span>
                    <span className="font-semibold text-on-surface">
                      {dayjs(selectedDate).format('ddd, DD/MM/YYYY')}
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-on-surface-variant">
                    <span>{t('roomRental.summaryTime', 'Window')}</span>
                    <span className="font-mono font-semibold text-on-surface">
                      {startTime} → {dayjs(endTimeISO).format('HH:mm')} ({durationHours}h)
                    </span>
                  </div>

                  {selectedMovie && (
                    <div className="flex justify-between items-start text-on-surface-variant pt-1 border-t border-outline-variant/20">
                      <span>{t('roomRental.summaryMovie', 'Movie')}</span>
                      <span className="font-semibold text-on-surface text-right truncate max-w-[180px]">
                        {selectedMovie.title}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pricing Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>{t('roomRental.ratePerHour', 'Hourly Rate')}</span>
                    <span className="font-bold text-on-surface text-sm">
                      {quote?.pricePerHour != null ? formatVND(quote.pricePerHour) : '—'}
                      <span className="text-[10px] text-on-surface-variant font-normal"> /hr</span>
                    </span>
                  </div>

                  {/* Active Rate Surcharges Badges */}
                  <div className="flex flex-wrap gap-1.5">
                    {isWeekendWindow(startTimeISO) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                        ⚡ {t('roomRental.weekendSurcharge', 'Weekend 1.5x')}
                      </span>
                    )}
                    {overlapsPeakHours(startTimeISO, endTimeISO) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
                        🔥 {t('roomRental.peakSurcharge', 'Peak 18:00–22:00 1.2x')}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center text-xs text-on-surface-variant">
                    <span>{t('roomRental.billedHours', 'Billed Hours')}</span>
                    <span className="font-bold text-on-surface">
                      {quote?.billedHours != null ? `${quote.billedHours} h` : `${durationHours} h`}
                    </span>
                  </div>

                  <div className="border-t border-outline-variant/30 pt-3 flex justify-between items-baseline">
                    <span className="text-sm font-bold text-on-surface">
                      {t('roomRental.totalAmount', 'Total Amount')}
                    </span>
                    <span className="text-2xl font-black text-primary">
                      {quote?.totalAmount != null ? formatVND(quote.totalAmount) : '—'}
                    </span>
                  </div>
                </div>

                {/* Quote Unavailable Callout */}
                {quote && !quote.available && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-xl text-xs animate-shake">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                    <div>
                      <p className="font-bold">
                        {t('roomRental.slotUnavailableTitle', 'Time Window Unavailable')}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed">
                        {getUnavailableReasonMessage(quote.unavailableCode)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Quote Error Callout */}
                {quoteError && (
                  <div className="flex items-start gap-2.5 p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-xl text-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{quoteError}</span>
                  </div>
                )}

                {/* Terms and policy highlights */}
                <div className="p-3 bg-surface-container rounded-xl space-y-1.5 text-[11px] text-on-surface-variant">
                  <p className="font-semibold text-on-surface flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    {t('roomRental.policyTitle', 'Booking Policy')}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1">
                    <li>{t('roomRental.policy1', 'Requests require staff confirmation (typically within 2 hours).')}</li>
                    <li>{t('roomRental.policy2', 'Payment window: 15 minutes after staff approval.')}</li>
                    <li>{t('roomRental.policy3', '100% refund available if cancelled at least 24h before start time.')}</li>
                  </ul>
                </div>

                {/* Action / Submit Button */}
                <div className="pt-2">
                  {!user ? (
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="w-full py-3 px-4 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-95 shadow-sm transition-all text-center flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {t('roomRental.signInToSubmit', 'Sign In to Submit Request')}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        isSubmitting ||
                        !selectedRoomId ||
                        !quote?.available ||
                        !isStartInFuture ||
                        isMovieTooLong
                      }
                      onClick={handleSubmitRental}
                      className="w-full py-3.5 px-4 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-95 shadow-md transition-all text-center flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t('roomRental.submitting', 'Submitting Request...')}
                        </>
                      ) : (
                        <>
                          {t('roomRental.submitRequest', 'Submit Rental Request')}
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </section>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
};

export default RoomRentalBooking;
