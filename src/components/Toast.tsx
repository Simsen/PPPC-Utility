import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastKind = 'ok' | 'err' | 'warn';

interface Props {
  toast: { kind: ToastKind; message: string } | null;
  onDismiss: () => void;
}

/** Lightweight toast pinned to the bottom-right. Auto-dismisses success toasts;
 *  error and warning toasts stay until the user dismisses them. */
export function Toast({ toast, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  // Keep the latest onDismiss in a ref so the auto-dismiss effect doesn't
  // re-subscribe (and reset its timer) on every parent render — the parent
  // re-creates the inline `() => setToast(null)` closure every time.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (toast.kind === 'ok') {
      let dismissTimer: ReturnType<typeof setTimeout> | undefined;
      const hideTimer = setTimeout(() => {
        setVisible(false);
        dismissTimer = setTimeout(() => onDismissRef.current(), 200);
      }, 3500);
      return () => {
        clearTimeout(hideTimer);
        if (dismissTimer) clearTimeout(dismissTimer);
      };
    }
  }, [toast]);

  if (!toast) return null;

  const isErr = toast.kind === 'err';
  const isWarn = toast.kind === 'warn';
  return (
    <div
      className={`fixed bottom-6 right-6 z-[60] flex items-start gap-3 max-w-md px-4 py-3 rounded-md border bg-card shadow-[var(--shadow-lift)] transition-all duration-200 ${
        isErr ? 'border-destructive/40' : isWarn ? 'border-warning/40' : 'border-primary/30'
      } ${visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {isErr ? (
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
      ) : isWarn ? (
        <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
      )}
      <div className="text-sm flex-1 min-w-0 whitespace-pre-line">{toast.message}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="text-muted-foreground hover:text-foreground p-0.5"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
