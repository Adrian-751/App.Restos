import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Mock wsManager ─────────────────────────────────────────────────────────

let msgListeners = []
let statusListeners = []

vi.mock('../../utils/wsManager', () => ({
    wsManager: {
        connect: vi.fn(),
        connected: false,
        on: vi.fn((cb) => {
            msgListeners.push(cb)
            return () => { msgListeners = msgListeners.filter((l) => l !== cb) }
        }),
        onStatus: vi.fn((cb) => {
            statusListeners.push(cb)
            return () => { statusListeners = statusListeners.filter((l) => l !== cb) }
        }),
    },
}))

import { useWsSubscription } from '../../hooks/useWsSubscription'
import { wsManager } from '../../utils/wsManager'

// ─── Helpers ────────────────────────────────────────────────────────────────

function simulateMessage(msg) {
    msgListeners.forEach((cb) => cb(msg))
}

function simulateStatus(connected) {
    statusListeners.forEach((cb) => cb(connected))
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
    msgListeners = []
    statusListeners = []
    vi.clearAllMocks()
})

describe('useWsSubscription', () => {
    it('calls wsManager.connect() on mount', () => {
        renderHook(() => useWsSubscription('pedido:', vi.fn()))
        expect(wsManager.connect).toHaveBeenCalled()
    })

    it('subscribes to messages via wsManager.on()', () => {
        renderHook(() => useWsSubscription('pedido:', vi.fn()))
        expect(wsManager.on).toHaveBeenCalledTimes(1)
        expect(msgListeners).toHaveLength(1)
    })

    it('subscribes to status via wsManager.onStatus()', () => {
        renderHook(() => useWsSubscription('pedido:', vi.fn()))
        expect(wsManager.onStatus).toHaveBeenCalledTimes(1)
        expect(statusListeners).toHaveLength(1)
    })

    it('passes matching messages (by prefix) to callback', () => {
        const callback = vi.fn()
        renderHook(() => useWsSubscription('pedido:', callback))

        act(() => simulateMessage({ event: 'pedido:created', data: { _id: '1' } }))
        expect(callback).toHaveBeenCalledWith({ event: 'pedido:created', data: { _id: '1' } })

        act(() => simulateMessage({ event: 'pedido:updated', data: { _id: '2' } }))
        expect(callback).toHaveBeenCalledTimes(2)
    })

    it('does NOT pass messages that don\'t match the prefix', () => {
        const callback = vi.fn()
        renderHook(() => useWsSubscription('pedido:', callback))

        act(() => simulateMessage({ event: 'mesa:updated', data: {} }))
        expect(callback).not.toHaveBeenCalled()

        act(() => simulateMessage({ event: 'caja:updated', data: {} }))
        expect(callback).not.toHaveBeenCalled()
    })

    it('passes all messages when prefix is empty string', () => {
        const callback = vi.fn()
        renderHook(() => useWsSubscription('', callback))

        act(() => simulateMessage({ event: 'anything:goes', data: {} }))
        expect(callback).toHaveBeenCalledTimes(1)
    })

    it('returns { connected } reflecting wsManager status', () => {
        const { result } = renderHook(() => useWsSubscription('pedido:', vi.fn()))
        expect(result.current.connected).toBe(false)

        act(() => simulateStatus(true))
        expect(result.current.connected).toBe(true)

        act(() => simulateStatus(false))
        expect(result.current.connected).toBe(false)
    })

    it('unsubscribes from messages and status on unmount', () => {
        const callback = vi.fn()
        const { unmount } = renderHook(() => useWsSubscription('pedido:', callback))

        expect(msgListeners).toHaveLength(1)
        expect(statusListeners).toHaveLength(1)

        unmount()

        expect(msgListeners).toHaveLength(0)
        expect(statusListeners).toHaveLength(0)
    })

    it('does not call stale callback after update', () => {
        const cb1 = vi.fn()
        const cb2 = vi.fn()
        const { rerender } = renderHook(({ cb }) => useWsSubscription('pedido:', cb), {
            initialProps: { cb: cb1 },
        })

        rerender({ cb: cb2 })

        act(() => simulateMessage({ event: 'pedido:created', data: {} }))

        expect(cb2).toHaveBeenCalledTimes(1)
        expect(cb1).not.toHaveBeenCalled()
    })
})
