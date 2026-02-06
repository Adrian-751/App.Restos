const EVENT_NAME = 'app-toast'

function emitToast(detail) {
  try {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }))
  } catch {
    // ignore (SSR / older browsers)
  }
}

export function toastSuccess(message, options = {}) {
  if (!message) return
  emitToast({ type: 'success', message, durationMs: options.durationMs ?? 1600 })
}

export function toastError(message, options = {}) {
  if (!message) return
  emitToast({ type: 'error', message, durationMs: options.durationMs ?? 4500 })
}

export function toastInfo(message, options = {}) {
  if (!message) return
  emitToast({ type: 'info', message, durationMs: options.durationMs ?? 2500 })
}

export const TOAST_EVENT_NAME = EVENT_NAME

