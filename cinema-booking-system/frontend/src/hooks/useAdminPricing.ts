import { useEffect, useState } from 'react';
import { adminService } from '../services/apiService';
import { AdminVoucher } from '../types/admin';

interface PricingTier {
  id: string;
  title: string;
  description: string;
  value: string;
  badge: string;
}

interface PricingOverview {
  baseRate: number;
  tiers: PricingTier[];
}

export const useAdminPricing = () => {
  const [pricing, setPricing] = useState<PricingOverview | null>(null);
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const [pricingData, voucherData] = await Promise.all([
          adminService.getPricingOverview(),
          adminService.getVouchers(),
        ]);
        setPricing(pricingData);
        setVouchers(voucherData);
      } catch (error) {
        console.error('Failed to load pricing data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPricing();
  }, []);

  return { pricing, vouchers, isLoading };
};
