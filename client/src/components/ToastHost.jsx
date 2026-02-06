import { useEffect, useRef, useState } from 'react'
import { TOAST_EVENT_NAME } from '../utils/toast'

const typeStyles = {
  success: 'bg-green-600/95 border-green-400 text-white',
  error: 'bg-red-600/95 border-red-400 text-white',
  info: 'bg-slate-800/95 border-slate-600 text-white',
}

export default function ToastHost() {
  const [toasts, setToasts] = useState([])
  const timeoutsRef = useRef(new Map())

  useEffect(() => {
    const onToast = (e) => {
      const detail = e?.detail || {}
      const message = String(detail.message || '').trim()
      if (!message) return

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const type = detail.type || 'info'
      const durationMs = Number(detail.durationMs) || 2500

      setToasts((prev) => [{ id, type, message }, ...prev].slice(0, 4))

      const t = setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== id))
        timeoutsRef.current.delete(id)
      }, durationMs)

      timeoutsRef.current.set(id, t)
    }

    window.addEventListener(TOAST_EVENT_NAME, onToast)
    return () => {
      window.removeEventListener(TOAST_EVENT_NAME, onToast)
      for (const [, t] of timeoutsRef.current) clearTimeout(t)
      timeoutsRef.current.clear()
    }
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-none max-w-[min(92vw,420px)] border rounded-lg shadow-xl px-4 py-3 text-sm font-semibold ${typeStyles[t.type] || typeStyles.info}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}

