import { useEffect, useState } from 'react';
import { adminService } from '../services/apiService';
import { AdminTheater } from '../types/admin';

export const useAdminRooms = () => {
  const [theaters, setTheaters] = useState<AdminTheater[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await adminService.getTheaters();
        setTheaters(data);
      } catch (error) {
        console.error('Failed to load theater data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadRooms();
  }, []);

  return { theaters, isLoading };
};
