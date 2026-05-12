import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { AdminShowtimeItem } from '../types/admin';

export const useAdminShowtimes = () => {
  const [showtimes, setShowtimes] = useState<AdminShowtimeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadShowtimes = async () => {
      try {
        const data = await adminService.getShowtimeSchedules();
        setShowtimes(data);
      } catch (error) {
        console.error('Failed to load showtime schedules:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadShowtimes();
  }, []);

  return { showtimes, isLoading };
};
