import { createSignal } from 'solid-js';
import { X, CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-solid';
import { cn } from '~/lib/utils';
import { getGlassClasses } from '~/lib/glass-utils';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

const [toasts, setToasts] = createSignal<Toast[]>([]);

export function showToast(toast: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).substr(2, 9);
  const newToast: Toast = { ...toast, id, duration: toast.duration ?? 5000 };

  setToasts((prev) => [...prev, newToast]);

  if (newToast.duration && newToast.duration > 0) {
    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);
  }

  return id;
}

export function removeToast(id: string) {
  setToasts((prev) => prev.filter((toast) => toast.id !== id));
}

export function clearToasts() {
  setToasts([]);
}

export function ToastContainer() {
  return (
    <div class="fixed top-4 right-4 z-50 space-y-2">
      {toasts().map((toast) => (
        <ToastItem toast={toast} />
      ))}
    </div>
  );
}

function ToastItem(props: { toast: Toast }) {
  const typeConfig = {
    success: {
      icon: CheckCircle2,
      borderColor: 'border-l-green-500/80',
      iconColor: 'text-green-400',
      textColor: 'text-foreground',
    },
    error: {
      icon: AlertCircle,
      borderColor: 'border-l-red-500/80',
      iconColor: 'text-red-400',
      textColor: 'text-foreground',
    },
    warning: {
      icon: AlertTriangle,
      borderColor: 'border-l-yellow-500/80',
      iconColor: 'text-yellow-400',
      textColor: 'text-foreground',
    },
    info: {
      icon: Info,
      borderColor: 'border-l-blue-500/80',
      iconColor: 'text-blue-400',
      textColor: 'text-foreground',
    },
  };

  const config = typeConfig[props.toast.type];
  const Icon = config.icon;

  const glassClasses = getGlassClasses('control', {
    blur: 'strong',
    background: 'heavy',
    shadow: 'lg',
    rounded: 'xl',
  });

  return (
    <div
      class={cn(
        glassClasses,
        'flex items-center gap-3 p-4 border-l-4',
        'transform transition-all duration-[var(--glass-transition-base)]',
        'max-w-sm min-w-[300px]',
        'animate-in slide-in-from-right-full fade-in',
        config.borderColor,
        config.textColor
      )}
    >
      <Icon class={cn('w-5 h-5 flex-shrink-0', config.iconColor)} />
      <span class="flex-1 text-sm font-medium">{props.toast.message}</span>
      <button
        onClick={() => removeToast(props.toast.id)}
        class={cn(
          'p-1 rounded-md transition-all duration-[var(--glass-transition-fast)]',
          'hover:bg-[var(--glass-bg-light)] text-muted-foreground hover:text-foreground'
        )}
        aria-label="Dismiss notification"
      >
        <X class="w-4 h-4" />
      </button>
    </div>
  );
}
