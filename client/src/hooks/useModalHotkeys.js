import { useEffect, useRef } from 'react'

function isFormField(el) {
  const tag = el?.tagName?.toUpperCase?.()
  if (tag === 'TEXTAREA') return true
  if (tag === 'INPUT') return true
  if (tag === 'SELECT') return true
  if (el?.isContentEditable) return true
  if (el?.closest?.('[role="listbox"], [role="combobox"], [role="option"]')) return true
  return false
}

/**
 * Atajos para modales:
 * - ESC => cancelar/cerrar
 * - ENTER => confirmar/guardar (solo si el foco NO está en un campo de formulario)
 */
export function useModalHotkeys({ isOpen, onCancel, onConfirm, confirmOnEnter = true }) {
  const onCancelRef = useRef(onCancel)
  const onConfirmRef = useRef(onConfirm)
  onCancelRef.current = onCancel
  onConfirmRef.current = onConfirm

  useEffect(() => {
    if (!isOpen) return

    const handler = (e) => {
      if (!e) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current?.()
        return
      }

      if (!confirmOnEnter) return
      if (e.key !== 'Enter') return
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
      if (isFormField(e.target)) return

      e.preventDefault()
      onConfirmRef.current?.()
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, confirmOnEnter])
}

