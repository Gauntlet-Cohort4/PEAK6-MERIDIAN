'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ToastVariant = 'success' | 'error' | 'info';

interface Toast {
  readonly id: string;
  readonly message: string;
  readonly variant: ToastVariant;
}

interface ToastContextValue {
  readonly toasts: readonly Toast[];
  readonly showToast: (message: string, variant?: ToastVariant) => void;
  readonly dismissToast: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

const TOAST_DURATION_MS = 4000;

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<readonly Toast[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'success') => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const toast: Toast = { id, message, variant };
      const MAX_TOASTS = 5;
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), toast]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Toast UI
// ---------------------------------------------------------------------------

function ToastContainer({
  toasts,
  onDismiss,
}: {
  readonly toasts: readonly Toast[];
  readonly onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success:
    'bg-green-900/90 text-green-100 border-green-700/50',
  error:
    'bg-red-900/90 text-red-100 border-red-700/50',
  info:
    'bg-blue-900/90 text-blue-100 border-blue-700/50',
};

function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: Toast;
  readonly onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`rounded-lg border px-4 py-3 text-sm shadow-lg animate-in slide-in-from-right-full ${VARIANT_CLASSES[toast.variant]}`}
      role="status"
      data-testid="toast"
    >
      <div className="flex items-center justify-between gap-3">
        <span>{toast.message}</span>
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss notification"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
