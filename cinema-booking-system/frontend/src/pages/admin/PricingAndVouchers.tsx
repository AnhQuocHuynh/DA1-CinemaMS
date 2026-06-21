import React, { useState } from 'react';
import { Download, Filter, Search } from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { AdminTopBar } from '../../components/admin/AdminTopBar';
import { useAdminPricing } from '../../hooks/useAdminPricing';
import { VoucherModal } from '../../components/admin/modals/VoucherModal';

export const PricingAndVouchers: React.FC = () => {
  const { pricing, vouchers, isLoading, addVoucher, deleteVoucher } = useAdminPricing();
  const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false);

  const handleAddVoucherClick = () => {
    setIsVoucherModalOpen(true);
  };

  const handleDeleteVoucherClick = async (id: string | number) => {
    if (window.confirm('Are you sure you want to delete this voucher?')) {
      await deleteVoucher(id);
    }
  };

  const handleVoucherSubmit = async (data: any) => {
    await addVoucher(data);
  };

  return (
    <AdminLayout activeItemId="pricing">
      <AdminTopBar title="Admin Console" searchPlaceholder="Search pricing rules..." />
      <main className="p-6 md:p-10 min-h-screen">
        <AdminPageHeader
          title="Pricing & Vouchers"
          subtitle="Configure global ticket price and manage vouchers."
          actions={
            <>
              <button className="bg-surface-container-highest text-primary font-bold px-6 py-3 rounded-md text-sm transition-all hover:bg-surface-container-high flex items-center gap-2">
                <Download className="w-4 h-4" />
                Download Report
              </button>
              <button onClick={handleAddVoucherClick} className="bg-primary text-white font-bold px-6 py-3 rounded-md text-sm transition-all hover:opacity-90 shadow-lg shadow-primary/10">
                + Create Voucher
              </button>
            </>
          }
        />

        {isLoading ? (
          <div className="text-center py-16 text-on-surface-variant">Loading pricing data...</div>
        ) : (
          <>
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-12">
              <div className="lg:col-span-1 bg-surface-container-lowest p-8 rounded-xl flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Standard Rate</span>
                  <h3 className="text-4xl font-black mt-2 mb-1">${pricing?.baseRate.toFixed(2)}</h3>
                  <p className="text-xs text-slate-500 font-medium">Universal base for all theaters</p>
                </div>
                <div className="mt-8">
                  <div className="relative">
                    <input
                      className="w-full bg-surface-container-highest border-none rounded-t-lg py-3 px-4 text-sm focus:ring-0"
                      placeholder="Set new rate"
                      type="text"
                    />
                    <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary scale-x-0 focus-within:scale-x-100 transition-transform origin-left"></div>
                  </div>
                  <button className="w-full mt-2 text-xs font-bold text-primary py-2 hover:bg-surface-container transition-colors">
                    Apply Global Update
                  </button>
                </div>
              </div>

              <div className="lg:col-span-2 bg-surface-container-low rounded-xl p-1 overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-1">
                {pricing?.tiers.map((tier) => (
                  <div key={tier.id} className="bg-surface-container-lowest p-6 flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <span className="text-primary font-bold text-sm">{tier.title}</span>
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                          {tier.badge}
                        </span>
                      </div>
                      <h4 className="text-lg font-bold mt-4">{tier.value}</h4>
                      <p className="text-xs text-slate-500 mt-1">{tier.description}</p>
                    </div>
                    <div className="mt-4">
                      <button className="text-[10px] font-bold text-primary px-3 py-1 bg-primary/5 rounded">
                        Edit Rules
                      </button>
                    </div>
                  </div>
                ))}
                <div className="bg-surface-container-lowest p-6 flex flex-col justify-between md:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-400">
                        Dynamic Surge Pricing
                      </span>
                      <p className="text-sm font-medium mt-1">
                        Automatic adjustment based on seat occupancy threshold (80%+)
                      </p>
                    </div>
                    <div className="w-12 h-6 bg-primary rounded-full relative cursor-pointer">
                      <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-low p-6 rounded-xl mt-12">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-on-background">Voucher Inventory</h3>
                  <p className="text-xs text-slate-500 font-medium">Active promotional codes and redemption metrics</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-surface-container-lowest px-4 py-2 rounded flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input
                      className="bg-transparent border-none text-sm p-0 focus:ring-0 w-32 md:w-48"
                      placeholder="Search codes..."
                      type="text"
                    />
                  </div>
                  <button className="bg-surface-container-lowest p-2 rounded text-slate-400 hover:text-primary transition-colors">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b border-slate-200">
                    <tr>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4">Code</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4">Discount</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4">Expiry</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4">Usage</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4">Status</th>
                      <th className="pb-4 text-[10px] font-bold uppercase tracking-widest text-slate-400 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {vouchers.map((voucher) => {
                      const limitLabel = voucher.usageLimit ? `${voucher.usageUsed}/${voucher.usageLimit}` : `${voucher.usageUsed} / ∞`;
                      const usagePercent = voucher.usageLimit
                        ? Math.min(100, (voucher.usageUsed / voucher.usageLimit) * 100)
                        : 20;

                      return (
                        <tr key={voucher.id} className="group hover:bg-white transition-colors">
                          <td className="py-4 px-4">
                            <span className="font-mono font-bold text-primary bg-primary/5 px-2 py-1 rounded">
                              {voucher.code}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-sm font-semibold">{voucher.discount}</td>
                          <td className="py-4 px-4 text-sm text-slate-600">{voucher.expiry}</td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${usagePercent}%` }}></div>
                              </div>
                              <span className="text-[10px] font-bold text-slate-500">{limitLabel}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${voucher.status === 'active'
                                  ? 'text-green-600 bg-green-50'
                                  : 'text-slate-400 bg-slate-100'
                                }`}
                            >
                              {voucher.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <button onClick={() => handleDeleteVoucherClick(voucher.id)} className="text-slate-300 hover:text-error transition-colors uppercase tracking-widest text-[10px] font-bold">Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <VoucherModal
        isOpen={isVoucherModalOpen}
        onClose={() => setIsVoucherModalOpen(false)}
        onSubmit={handleVoucherSubmit}
      />
    </AdminLayout>
  );
};
