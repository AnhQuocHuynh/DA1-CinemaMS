import { useState } from 'react';
import { staffService } from '../services/apiService';
import { StaffBookingValidation } from '../types/staff';

export const useTicketLookup = () => {
  const [result, setResult] = useState<StaffBookingValidation | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchTicket = async (query: string) => {
    setIsSearching(true);
    try {
      const data = await staffService.lookupTicket(query);
      setResult(data);
    } catch (error) {
      console.error('Failed to lookup ticket:', error);
      setResult(null);
    } finally {
      setIsSearching(false);
    }
  };

  return { result, isSearching, searchTicket };
};
