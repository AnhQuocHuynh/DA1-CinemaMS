import { useState } from 'react';
import { staffService } from '../services/apiService';
import { StaffScanResult } from '../types/staff';

export const useQrScanner = () => {
  const [scanResult, setScanResult] = useState<StaffScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const scanTicket = async (ticketCode: string) => {
    setIsScanning(true);
    try {
      const result = await staffService.scanTicket(ticketCode);
      setScanResult(result);
    } catch (error) {
      console.error('Failed to scan ticket:', error);
      setScanResult({ status: 'invalid', seatLabel: 'N/A', ticketType: 'Unknown' });
    } finally {
      setIsScanning(false);
    }
  };

  const clearResult = () => setScanResult(null);

  return { scanResult, isScanning, scanTicket, clearResult };
};
