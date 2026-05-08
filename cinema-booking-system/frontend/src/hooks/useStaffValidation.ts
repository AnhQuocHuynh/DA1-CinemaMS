import { useEffect, useState } from 'react';
import { staffService } from '../services/apiService';
import { StaffBookingValidation, StaffValidationStats } from '../types/staff';

export const useStaffValidation = () => {
  const [stats, setStats] = useState<StaffValidationStats | null>(null);
  const [bookings, setBookings] = useState<StaffBookingValidation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadValidation = async () => {
      try {
        const [statsData, bookingsData] = await Promise.all([
          staffService.getValidationStats(),
          staffService.getValidationBookings(),
        ]);
        setStats(statsData);
        setBookings(bookingsData);
      } catch (error) {
        console.error('Failed to load validation data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadValidation();
  }, []);

  return { stats, bookings, isLoading };
};
