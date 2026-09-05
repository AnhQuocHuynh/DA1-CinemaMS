import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { Flashlight, Keyboard, X } from 'lucide-react';
import { StaffScanResult } from '../../types/staff';
import { bookingService } from '../../services/bookingService';

export const QRChecker: React.FC = () => {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const processingRef = useRef(false);
  const [scanResult, setScanResult] = useState<StaffScanResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    try {
      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (!result || processingRef.current) return;
          processingRef.current = true;

          const decodedText = result.getText();
          const parts = decodedText.split('|');

          if (parts.length < 2 || parts[0] !== 'CINEMA') {
            setScanResult({ status: 'invalid', seatLabel: 'Unknown', ticketType: 'QR' });
            setIsScanning(false);
            stopScanner();
            return;
          }

          const ticketCode = parts[1];
          const seatLabel = parts.length >= 3 ? parts[2].replace('SEAT:', '') : ticketCode;

          bookingService.checkInTicket(ticketCode)
            .then(() => {
              console.log('✅ [STAFF] Check-in ticket:', ticketCode);
              setScanResult({ status: 'valid', seatLabel: seatLabel, ticketType: 'QR' });
            })
            .catch((error) => {
              console.error('Failed to check in:', error);
              setScanResult({ status: 'invalid', seatLabel: seatLabel, ticketType: 'QR' });
              const e = error as { response?: { data?: { message?: string } } };
              setErrorMessage(e.response?.data?.message || 'Lỗi khi check-in');
            })
            .finally(() => {
              setIsScanning(false);
              stopScanner();
            });
        }
      );
    } catch (error) {
      console.error('Failed to start QR scanner:', error);
      setErrorMessage('Unable to access the camera. Please check permissions and try again.');
      setIsScanning(false);
    }
  };

  const restartScanner = () => {
    processingRef.current = false;
    setScanResult(null);
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

  return (
    <div className="bg-inverse-surface text-on-surface min-h-screen overflow-hidden">
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-black/40"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <header className="p-6 pt-12 flex justify-between items-start">
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Scan Tickets</h1>
            <p className="text-inverse-on-surface text-sm font-medium mt-1 uppercase tracking-widest">Cinema 04 • Evening Show</p>
          </div>
          <button
            onClick={() => {
              stopScanner();
              navigate('/staff/dashboard');
            }}
            className="w-12 h-12 rounded-full bg-surface-container-lowest/10 backdrop-blur-md flex items-center justify-center text-white active:scale-90 transition-transform"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-grow flex flex-col items-center justify-center px-8">
          <div className="relative w-full aspect-square max-w-[320px]">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              muted
              playsInline
            />
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
          {errorMessage && (
            <p className="mt-12 text-sm text-error text-center max-w-xs">{errorMessage}</p>
          )}
        </main>

        <div className="px-6 pb-24 grid grid-cols-2 gap-4">
          <button
            className="bg-surface-container-lowest/10 backdrop-blur-lg rounded-xl py-4 flex flex-col items-center gap-2 text-white active:bg-surface-container-lowest/20 transition-all"
            onClick={() => restartScanner()}
            disabled={isScanning}
          >
            <Flashlight className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">{isScanning ? 'Scanning' : 'Flash Off'}</span>
          </button>
          <button
            className="bg-surface-container-lowest/10 backdrop-blur-lg rounded-xl py-4 flex flex-col items-center gap-2 text-white active:bg-surface-container-lowest/20 transition-all"
            onClick={() => {
              const code = window.prompt('Nhập mã vé thủ công (VD: TK-12345678):');
              if (code) {
                setIsScanning(true);
                stopScanner();
                bookingService.checkInTicket(code)
                  .then(() => {
                    setScanResult({ status: 'valid', seatLabel: code, ticketType: 'MANUAL' });
                  })
                  .catch((error) => {
                    setScanResult({ status: 'invalid', seatLabel: code, ticketType: 'MANUAL' });
                    const e = error as { response?: { data?: { message?: string } } };
                    setErrorMessage(e.response?.data?.message || 'Lỗi khi check-in');
                  })
                  .finally(() => {
                    setIsScanning(false);
                  });
              }
            }}
          >
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
