import { useEffect } from 'react'

function isTextAreaLike(el) {
  const tag = el?.tagName?.toUpperCase?.()
  if (tag === 'TEXTAREA') return true
  if (el?.isContentEditable) return true
  return false
}

/**
 * Atajos para modales:
 * - ESC => cancelar/cerrar
 * - ENTER => confirmar/guardar (ignora textarea/contenteditable)
 */
export function useModalHotkeys({ isOpen, onCancel, onConfirm, confirmOnEnter = true }) {
  useEffect(() => {
    if (!isOpen) return

    const handler = (e) => {
      if (!e) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
        return
      }

      if (!confirmOnEnter) return
      if (e.key !== 'Enter') return
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      if (isTextAreaLike(e.target)) return

      e.preventDefault()
      onConfirm?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onCancel, onConfirm, confirmOnEnter])
}

