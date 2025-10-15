import toast, { type ToastOptions } from "solid-toast";

export interface ToastMessage {
  title: string;
  description?: string;
}

// Helper function to format message with optional description
function formatMessage(message: string | ToastMessage): string {
  if (typeof message === "string") {
    return message;
  }

  if (message.description) {
    return `${message.title}\n${message.description}`;
  }

  return message.title;
}

// Default toast function
export function showToast(
  message: string | ToastMessage,
  options?: ToastOptions
) {
  return toast(formatMessage(message), options);
}

// Success toast
export function showSuccessToast(
  message: string | ToastMessage,
  options?: ToastOptions
) {
  return toast.success(formatMessage(message), options);
}

// Error toast
export function showErrorToast(
  message: string | ToastMessage,
  options?: ToastOptions
) {
  return toast.error(formatMessage(message), options);
}

// Loading toast
export function showLoadingToast(
  message: string | ToastMessage,
  options?: ToastOptions
) {
  return toast.loading(formatMessage(message), options);
}

// Promise toast
export function showPromiseToast<T>(
  promise: Promise<T>,
  messages: {
    loading: string | ToastMessage;
    success: string | ToastMessage;
    error: string | ToastMessage;
  },
  options?: ToastOptions
) {
  return toast.promise(promise, {
    loading: formatMessage(messages.loading),
    success: formatMessage(messages.success),
    error: formatMessage(messages.error),
    ...options,
  });
}

export type { ToastOptions } from "solid-toast";
// Re-export solid-toast utilities
export { toast, toast as default } from "solid-toast";
