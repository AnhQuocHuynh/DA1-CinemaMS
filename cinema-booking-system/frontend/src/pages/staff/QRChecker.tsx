import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Flashlight, Keyboard, RefreshCw, X } from 'lucide-react';
import { StaffScanResult } from '../../types/staff';
import { bookingService } from '../../services/bookingService';
import { useTranslation } from 'react-i18next';

interface RecentScanItem {
  code: string;
  status: 'valid' | 'invalid';
  label: string;
  time: string;
}

export const QRChecker: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const [scanResult, setScanResult] = useState<StaffScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [showManualSheet, setShowManualSheet] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);

  const pushRecentScan = (code: string, status: 'valid' | 'invalid', label: string) => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setRecentScans((prev) => [{ code, status, label, time }, ...prev].slice(0, 3));
  };

  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    const video = videoRef.current;
    if (video?.srcObject) {
      const stream = video.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  };

  const handleDecodedText = (decodedText: string) => {
    const parts = decodedText.split('|');

    if (parts.length < 2 || parts[0] !== 'CINEMA') {
      setScanResult({ status: 'invalid', seatLabel: 'Unknown', ticketType: 'QR' });
      pushRecentScan('QR', 'invalid', 'Unknown');
      setIsScanning(false);
      stopScanner();
      return;
    }

    const ticketCode = parts[1];
    const seatLabel = parts.length >= 3 ? parts[2].replace('SEAT:', '') : ticketCode;

    bookingService
      .checkInTicket(ticketCode)
      .then(() => {
        console.log('✅ [STAFF] Check-in ticket:', ticketCode);
        setScanResult({ status: 'valid', seatLabel, ticketType: 'QR' });
        pushRecentScan(ticketCode, 'valid', seatLabel);
      })
      .catch((error) => {
        console.error('Failed to check in:', error);
        setScanResult({ status: 'invalid', seatLabel, ticketType: 'QR' });
        pushRecentScan(ticketCode, 'invalid', seatLabel);
        const e = error as { response?: { data?: { message?: string } } };
        setErrorMessage(e.response?.data?.message || t('staffQRChecker.errorCheckIn', 'Lỗi khi check-in'));
      })
      .finally(() => {
        setIsScanning(false);
        stopScanner();
      });
  };

  const startScanner = async () => {
    if (!videoRef.current) {
      return;
    }

    setErrorMessage(null);
    setIsScanning(true);

    if (!readerRef.current) {
      readerRef.current = new BrowserQRCodeReader();
    }

    const onDecode = (result: { getText: () => string } | undefined) => {
      if (!result || processingRef.current) return;
      processingRef.current = true;
      handleDecodedText(result.getText());
    };

    try {
      try {
        controlsRef.current = await readerRef.current.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          onDecode
        );
      } catch {
        controlsRef.current = await readerRef.current.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          onDecode
        );
      }

      const stream = videoRef.current?.srcObject as MediaStream | null;
      const track = stream?.getVideoTracks?.()[0];
      const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorchSupported(Boolean(capabilities?.torch));
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      setErrorMessage(
        t('staffQRChecker.errorCamera', 'Unable to access the camera. Please check permissions and try again.')
      );
      setIsScanning(false);
    }
  };

  const toggleTorch = async () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track || !torchSupported) return;
    const nextTorch = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorch } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorch);
    } catch (err) {
      console.warn('Torch toggle failed:', err);
    }
  };

  const restartScanner = () => {
    processingRef.current = false;
    setScanResult(null);
    setErrorMessage(null);
    startScanner();
  };

  useEffect(() => {
    startScanner();
    return () => stopScanner();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopScanner();
      }
    };

    const handlePageHide = () => {
      stopScanner();
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const clearResult = () => {
    setScanResult(null);
    restartScanner();
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim().toUpperCase();
    if (!code || isManualSubmitting) return;

    setIsManualSubmitting(true);
    setErrorMessage(null);
    stopScanner();
    try {
      await bookingService.checkInTicket(code);
      setScanResult({ status: 'valid', seatLabel: code, ticketType: 'MANUAL' });
      pushRecentScan(code, 'valid', code);
      setShowManualSheet(false);
      setManualCode('');
    } catch (error) {
      setScanResult({ status: 'invalid', seatLabel: code, ticketType: 'MANUAL' });
      pushRecentScan(code, 'invalid', code);
      const err = error as { response?: { data?: { message?: string } } };
      setErrorMessage(err.response?.data?.message || t('staffQRChecker.errorCheckIn', 'Lỗi khi check-in'));
      setShowManualSheet(false);
    } finally {
      setIsManualSubmitting(false);
    }
  };

  return (
    <div className="bg-inverse-surface text-on-surface min-h-[100dvh] overflow-y-auto pb-safe">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-[100dvh] justify-between">
        <header className="p-4 pt-6 sm:p-6 sm:pt-10 pt-safe flex justify-between items-start gap-3">
          <div className="min-w-0">
            <h1 className="text-white text-xl sm:text-2xl font-bold tracking-tight truncate">
              {t('staffQRChecker.title', 'Scan Tickets')}
            </h1>
            <p className="text-inverse-on-surface text-xs sm:text-sm font-medium mt-1 uppercase tracking-widest truncate">
              {t('staffQRChecker.subtitle', 'Cinema 04 • Evening Show')}
            </p>
          </div>
          <button
            onClick={() => {
              stopScanner();
              navigate('/staff/dashboard');
            }}
            className="w-11 h-11 rounded-full bg-surface-container-lowest/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform shrink-0"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center px-5 sm:px-8 py-4">
          <div className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px]">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover rounded-2xl bg-black/50"
              muted
              playsInline
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-white rounded-tl-xl"></div>
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-white rounded-tr-xl"></div>
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-white rounded-bl-xl"></div>
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-white rounded-br-xl"></div>
            </div>
            <div className="absolute top-1/2 w-full h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_15px_rgba(37,99,235,0.8)] pointer-events-none"></div>
          </div>

          <p className="text-white/80 text-xs sm:text-sm font-medium tracking-wide text-center mt-4">
            {t('staffQRChecker.alignQR', 'Align QR code within the frame')}
          </p>

          {errorMessage && (
            <p className="mt-3 text-xs sm:text-sm text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded-lg px-3 py-2 text-center max-w-xs">
              {errorMessage}
            </p>
          )}

          {recentScans.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-1.5 max-w-sm">
              {recentScans.map((item, idx) => (
                <span
                  key={`${item.code}-${idx}`}
                  className={`text-[11px] font-mono px-2.5 py-1 rounded-full border ${
                    item.status === 'valid'
                      ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
                      : 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                  }`}
                >
                  {item.status === 'valid' ? '✓' : '✕'} {item.label} ({item.time})
                </span>
              ))}
            </div>
          )}
        </main>

        <div className="px-4 sm:px-6 pb-6 pb-safe space-y-3 max-w-md w-full mx-auto">
          {scanResult && (
            <div className="z-40">
              <div
                className={`bg-surface-container-lowest rounded-xl p-4 shadow-2xl flex items-center gap-3 border-l-4 ${
                  scanResult.status === 'valid' ? 'border-primary' : 'border-error'
                }`}
              >
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${
                    scanResult.status === 'valid' ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'
                  }`}
                >
                  <span className="text-xl">{scanResult.status === 'valid' ? '✓' : '!'}</span>
                </div>
                <div className="flex-grow min-w-0">
                  <h3 className="text-on-surface font-bold text-base sm:text-lg leading-tight">
                    {scanResult.status === 'valid'
                      ? t('staffQRChecker.ticketValid', 'Ticket Valid')
                      : t('staffQRChecker.ticketInvalid', 'Ticket Invalid')}
                  </h3>
                  <p className="text-on-surface-variant text-xs sm:text-sm truncate">
                    {scanResult.seatLabel} • {scanResult.ticketType}
                  </p>
                </div>
                <button
                  type="button"
                  className="px-3 py-2 min-h-[44px] rounded-lg bg-primary/10 text-primary font-bold text-xs uppercase tracking-wider shrink-0"
                  onClick={clearResult}
                >
                  {t('staffQRChecker.scanNext', 'Scan Next')}
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {torchSupported ? (
              <button
                type="button"
                className={`backdrop-blur-lg rounded-xl py-3.5 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-white transition-all ${
                  torchOn ? 'bg-amber-500/40 ring-2 ring-amber-400' : 'bg-surface-container-lowest/10 active:bg-surface-container-lowest/20'
                }`}
                onClick={toggleTorch}
              >
                <Flashlight className="w-5 h-5" />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {torchOn ? t('staffQRChecker.flashOn', 'Flash On') : t('staffQRChecker.flashOff', 'Flash Off')}
                </span>
              </button>
            ) : (
              <button
                type="button"
                className="bg-surface-container-lowest/10 backdrop-blur-lg rounded-xl py-3.5 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-white active:bg-surface-container-lowest/20 transition-all"
                onClick={restartScanner}
              >
                <RefreshCw className={`w-5 h-5 ${isScanning ? 'animate-spin' : ''}`} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {isScanning ? t('staffQRChecker.scanning', 'Scanning') : t('staffQRChecker.restart', 'Restart')}
                </span>
              </button>
            )}

            <button
              type="button"
              className="bg-surface-container-lowest/10 backdrop-blur-lg rounded-xl py-3.5 min-h-[64px] flex flex-col items-center justify-center gap-1.5 text-white active:bg-surface-container-lowest/20 transition-all"
              onClick={() => setShowManualSheet(true)}
            >
              <Keyboard className="w-5 h-5" />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                {t('staffQRChecker.manualEntry', 'Manual Entry')}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Inline Manual Code Bottom Sheet */}
      {showManualSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowManualSheet(false)}
        >
          <form
            onSubmit={handleManualSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md bg-surface-container-lowest text-on-surface rounded-t-2xl sm:rounded-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-on-surface">
                {t('staffQRChecker.manualEntry', 'Manual Entry')}
              </h2>
              <button
                type="button"
                onClick={() => setShowManualSheet(false)}
                className="w-10 h-10 -mr-2 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <input
              autoFocus
              type="text"
              autoCapitalize="characters"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="TK-12345678"
              className="w-full min-h-[48px] px-4 rounded-xl border border-outline-variant bg-surface-container text-base font-mono font-bold uppercase text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowManualSheet(false)}
                className="flex-1 min-h-[48px] rounded-xl border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={!manualCode.trim() || isManualSubmitting}
                className="flex-1 min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-bold disabled:opacity-50"
              >
                {isManualSubmitting ? t('common.loading', 'Loading...') : t('staffQRChecker.validateBtn', 'Check-in')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
