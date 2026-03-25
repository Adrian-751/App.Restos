import { useEffect, useRef, useState } from 'react'
import { wsManager } from '../utils/wsManager'

/**
 * Subscribe to WebSocket events whose `event` field starts with `eventPrefix`.
 * Ensures the WS connection is alive and returns connection status.
 *
 * @param {string} eventPrefix - e.g. 'pedido:' to match 'pedido:created', etc.
 * @param {function} callback  - called with the parsed message object
 * @returns {{ connected: boolean }}
 */
export function useWsSubscription(eventPrefix, callback) {
    const [connected, setConnected] = useState(wsManager.connected)
    const cbRef = useRef(callback)
    cbRef.current = callback

    useEffect(() => {
        wsManager.connect()

        const unsubMsg = wsManager.on((msg) => {
            if (!eventPrefix || msg.event?.startsWith(eventPrefix)) {
                cbRef.current?.(msg)
            }
        })

        const unsubStatus = wsManager.onStatus(setConnected)

        return () => {
            unsubMsg()
            unsubStatus()
        }
    }, [eventPrefix])

    return { connected }
}
