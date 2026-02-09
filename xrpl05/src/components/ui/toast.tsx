import { component$, useSignal, $, type QRL } from "@builder.io/qwik";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

export const useToast = () => {
  const toasts = useSignal<Toast[]>([]);

  const addToast = $((toast: Omit<Toast, "id">) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = {
      ...toast,
      id,
      duration: toast.duration ?? 5000,
    };

    toasts.value = [...toasts.value, newToast];

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, newToast.duration);
    }
  });

  const removeToast = $((id: string) => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  });

  const success = $((title: string, message?: string) => {
    addToast({ type: "success", title, message });
  });

  const error = $((title: string, message?: string) => {
    addToast({ type: "error", title, message });
  });

  const warning = $((title: string, message?: string) => {
    addToast({ type: "warning", title, message });
  });

  const info = $((title: string, message?: string) => {
    addToast({ type: "info", title, message });
  });

  return {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info,
  };
};

const getToastIcon = (type: ToastType) => {
  switch (type) {
    case "success":
      return "✓";
    case "error":
      return "✕";
    case "warning":
      return "⚠";
    case "info":
      return "ℹ";
  }
};

interface ToastItemProps {
  toast: Toast;
  onClose$: QRL<(id: string) => void>;
}

const ToastItem = component$<ToastItemProps>(({ toast, onClose$ }) => {
  const isExiting = useSignal(false);

  const handleClose$ = $(() => {
    isExiting.value = true;
    setTimeout(() => {
      onClose$(toast.id);
    }, 300);
  });

  return (
    <div
      class={`toast ${toast.type} ${isExiting.value ? "exit" : ""}`}
      role="alert"
      aria-live="polite"
    >
      <div class="toast-icon">{getToastIcon(toast.type)}</div>
      <div class="toast-content">
        <div class="toast-title">{toast.title}</div>
        {toast.message && <div class="toast-message">{toast.message}</div>}
      </div>
      <button
        class="toast-close"
        onClick$={handleClose$}
        aria-label="Close notification"
      >
        ✕
      </button>
    </div>
  );
});

interface ToastContainerProps {
  toasts: Toast[];
  onClose: QRL<(id: string) => void>;
}

export const ToastContainer = component$<ToastContainerProps>(
  ({ toasts, onClose }) => {
    return (
      <div class="toast-container" role="region" aria-label="Notifications">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose$={onClose} />
        ))}
      </div>
    );
  },
);
