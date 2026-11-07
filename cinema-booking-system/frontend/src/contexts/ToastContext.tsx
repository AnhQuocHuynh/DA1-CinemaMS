import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { PushNotificationPayload } from '../types/notification';

type ToastType = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  action?: ToastAction;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
  addNotificationToast: (
    title: string,
    message: string,
    type: ToastType,
    action?: ToastAction
  ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const addNotificationToast = (
    title: string,
    message: string,
    type: ToastType,
    action?: ToastAction
  ) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message, action }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const handlePushEvent = (e: Event) => {
      const payload = (e as CustomEvent<PushNotificationPayload>).detail;
      if (!payload) return;

      let toastType: ToastType = 'info';
      if (
        payload.type === 'BOOKING_CONFIRMATION' ||
        payload.metadata?.actionType === 'ORDER_CONFIRMED'
      ) {
        toastType = 'success';
      } else if (
        payload.type === 'PAYMENT_FAILED' ||
        payload.type === 'BOOKING_CANCELLED' ||
        payload.metadata?.actionType === 'PAYMENT_FAILED' ||
        payload.metadata?.actionType === 'ORDER_CANCELLED'
      ) {
        toastType = 'error';
      }

      const actionUrl = payload.metadata?.actionUrl;
      const action = actionUrl
        ? {
            label:
              payload.metadata?.actionType === 'ORDER_CONFIRMED'
                ? 'View Tickets'
                : payload.metadata?.actionType === 'PAYMENT_FAILED'
                ? 'Retry'
                : 'View Details',
            onClick: () => {
              window.location.href = actionUrl;
            },
          }
        : undefined;

      addNotificationToast(payload.title, payload.body, toastType, action);
    };

    window.addEventListener('cinema-push-notification', handlePushEvent);
    return () => {
      window.removeEventListener('cinema-push-notification', handlePushEvent);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, addNotificationToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-2xl backdrop-blur-md border text-white transform transition-all duration-300 animate-slide-up ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
                : 'bg-zinc-900/90 border-zinc-700/50 text-zinc-100'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : toast.type === 'error' ? (
                <AlertTriangle className="w-5 h-5 text-rose-400" />
              ) : (
                <Info className="w-5 h-5 text-sky-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              {toast.title && (
                <h4 className="font-semibold text-sm leading-tight mb-1 text-white">
                  {toast.title}
                </h4>
              )}
              <p className="text-xs text-zinc-300 leading-relaxed">{toast.message}</p>

              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    removeToast(toast.id);
                  }}
                  className={`mt-2.5 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium tracking-wide shadow-sm transition-colors ${
                    toast.type === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : toast.type === 'error'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-sky-600 hover:bg-sky-500 text-white'
                  }`}
                >
                  {toast.action.label}
                </button>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
