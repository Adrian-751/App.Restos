import { useEffect } from 'react'

/**
 * Bloquea el scroll del body cuando un modal está abierto.
 * Importante para móviles (iOS Safari) para evitar que se scrollee el contenido de atrás.
 */
export function useLockBodyScroll(locked) {
    useEffect(() => {
        if (!locked) return

        const body = document.body
        const scrollY = window.scrollY || 0

        const prevOverflow = body.style.overflow
        const prevPosition = body.style.position
        const prevTop = body.style.top
        const prevWidth = body.style.width

        body.style.overflow = 'hidden'
        body.style.position = 'fixed'
        body.style.top = `-${scrollY}px`
        body.style.width = '100%'

        return () => {
            body.style.overflow = prevOverflow
            body.style.position = prevPosition
            body.style.top = prevTop
            body.style.width = prevWidth
            window.scrollTo(0, scrollY)
        }
    }, [locked])
}

