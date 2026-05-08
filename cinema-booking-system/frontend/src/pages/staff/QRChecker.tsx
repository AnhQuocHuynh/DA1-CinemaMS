import React from 'react';
import { Flashlight, Keyboard, X } from 'lucide-react';
import { useQrScanner } from '../../hooks/useQrScanner';

export const QRChecker: React.FC = () => {
  const { scanResult, isScanning, scanTicket, clearResult } = useQrScanner();

  return (
    <div className="bg-inverse-surface text-on-surface min-h-screen overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="p-6 pt-12 flex justify-between items-start">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Scan Tickets</h1>
            <p className="text-slate-300 text-sm font-medium mt-1 uppercase tracking-widest">Cinema 04 • Evening Show</p>
          </div>
          <button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform">
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center px-8">
          <div className="relative w-full aspect-square max-w-[320px]">
            <div className="absolute inset-0">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-xl"></div>
            </div>
            <div className="absolute top-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(37,99,235,0.8)]"></div>
            <div className="absolute -bottom-12 left-0 right-0 text-center">
              <p className="text-white/80 text-sm font-medium tracking-wide">Align QR code within the frame</p>
            </div>
          </div>
        </main>

        <div className="px-6 pb-24 grid grid-cols-2 gap-4">
          <button
            className="bg-white/10 backdrop-blur-lg rounded-xl py-4 flex flex-col items-center gap-2 text-white active:bg-white/20 transition-all"
            onClick={() => scanTicket('demo-ticket')}
            disabled={isScanning}
          >
            <Flashlight className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{isScanning ? 'Scanning' : 'Flash Off'}</span>
          </button>
          <button className="bg-white/10 backdrop-blur-lg rounded-xl py-4 flex flex-col items-center gap-2 text-white active:bg-white/20 transition-all">
            <Keyboard className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Manual Entry</span>
          </button>
        </div>

        {scanResult && (
          <div className="fixed bottom-32 left-6 right-6 transform transition-all translate-y-0 opacity-100">
            <div
              className={`bg-surface-container-lowest rounded-xl p-4 shadow-2xl flex items-center gap-4 border-l-4 ${
                scanResult.status === 'valid' ? 'border-primary' : 'border-error'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  scanResult.status === 'valid' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                }`}
              >
                <span className="text-xl">{scanResult.status === 'valid' ? '✓' : '!'}</span>
              </div>
              <div className="flex-grow">
                <h3 className="text-on-surface font-bold text-lg leading-tight">
                  {scanResult.status === 'valid' ? 'Ticket Valid' : 'Ticket Invalid'}
                </h3>
                <p className="text-on-surface-variant text-sm">
                  {scanResult.seatLabel} • {scanResult.ticketType}
                </p>
              </div>
              <button className="text-primary font-bold text-xs uppercase tracking-tighter" onClick={clearResult}>
                Undo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
