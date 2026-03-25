import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── MockWebSocket ──────────────────────────────────────────────────────────

const mockWsInstances = []

class MockWebSocket {
    static CONNECTING = 0
    static OPEN = 1
    static CLOSING = 2
    static CLOSED = 3

    constructor(url) {
        this.url = url
        this.readyState = MockWebSocket.CONNECTING
        this.onopen = null
        this.onclose = null
        this.onmessage = null
        this.onerror = null
        mockWsInstances.push(this)
    }
    send = vi.fn()
    close = vi.fn(function () {
        this.readyState = MockWebSocket.CLOSED
        if (this.onclose) this.onclose()
    })
    _open() {
        this.readyState = MockWebSocket.OPEN
        if (this.onopen) this.onopen()
    }
    _message(data) {
        if (this.onmessage) this.onmessage({ data: JSON.stringify(data) })
    }
    _close() {
        this.readyState = MockWebSocket.CLOSED
        if (this.onclose) this.onclose()
    }
    _error() {
        if (this.onerror) this.onerror()
    }
}

// Must be set before importing wsManager (constructor doesn't use it, but connect() does)
globalThis.WebSocket = MockWebSocket

// Import singleton after mock is set
const { wsManager } = await import('../../utils/wsManager.js')

// ─── Helpers ────────────────────────────────────────────────────────────────

function latestWs() {
    return mockWsInstances[mockWsInstances.length - 1]
}

// ─── Tests ──────────────────────────────────────────────────────────────────

beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    mockWsInstances.length = 0
    wsManager.disconnect()
    wsManager._listeners.clear()
    wsManager._statusListeners.clear()
    wsManager._backoff = 1000
})

afterEach(() => {
    wsManager.disconnect()
    vi.useRealTimers()
})

describe('WsManager – connect', () => {
    it('does nothing when no token in localStorage', () => {
        wsManager.connect()
        expect(mockWsInstances).toHaveLength(0)
    })

    it('creates WebSocket with token and tenant in URL', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()

        expect(mockWsInstances).toHaveLength(1)
        const ws = latestWs()
        expect(ws.url).toContain('token=jwt-abc')
        expect(ws.url).toContain('tenant=default')
        expect(ws.url).toMatch(/^ws:\/\//)
        expect(ws.url).toContain('/ws?')
    })

    it('uses tenant from localStorage when in dev/localhost', () => {
        localStorage.setItem('token', 'jwt-abc')
        localStorage.setItem('tenant', 'mibistro')
        wsManager.connect()

        const ws = latestWs()
        expect(ws.url).toContain('tenant=mibistro')
    })

    it('does nothing when already connecting', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        wsManager.connect()

        expect(mockWsInstances).toHaveLength(1)
    })

    it('does nothing when already open', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        wsManager.connect()
        expect(mockWsInstances).toHaveLength(1)
    })
})

describe('WsManager – connection lifecycle', () => {
    it('sets connected=true and notifies listeners on open', () => {
        localStorage.setItem('token', 'jwt-abc')
        const statusCb = vi.fn()
        wsManager.onStatus(statusCb)

        wsManager.connect()
        expect(wsManager.connected).toBe(false)

        latestWs()._open()
        expect(wsManager.connected).toBe(true)
        expect(statusCb).toHaveBeenCalledWith(true)
    })

    it('sets connected=false on close and notifies', () => {
        localStorage.setItem('token', 'jwt-abc')
        const statusCb = vi.fn()
        wsManager.onStatus(statusCb)

        wsManager.connect()
        latestWs()._open()
        statusCb.mockClear()

        latestWs()._close()
        expect(wsManager.connected).toBe(false)
        expect(statusCb).toHaveBeenCalledWith(false)
    })
})

describe('WsManager – disconnect', () => {
    it('closes the WebSocket and resets state', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        const ws = latestWs()
        ws._open()

        wsManager.disconnect()
        expect(ws.close).toHaveBeenCalled()
        expect(wsManager.connected).toBe(false)
    })

    it('does not crash when called without active connection', () => {
        expect(() => wsManager.disconnect()).not.toThrow()
    })
})

describe('WsManager – message routing', () => {
    it('routes messages to all subscribed listeners', () => {
        localStorage.setItem('token', 'jwt-abc')
        const cb1 = vi.fn()
        const cb2 = vi.fn()
        wsManager.on(cb1)
        wsManager.on(cb2)

        wsManager.connect()
        latestWs()._open()
        latestWs()._message({ event: 'pedido:created', data: { _id: '1' } })

        expect(cb1).toHaveBeenCalledWith({ event: 'pedido:created', data: { _id: '1' } })
        expect(cb2).toHaveBeenCalledWith({ event: 'pedido:created', data: { _id: '1' } })
    })

    it('does not route application-level pong messages', () => {
        localStorage.setItem('token', 'jwt-abc')
        const cb = vi.fn()
        wsManager.on(cb)

        wsManager.connect()
        latestWs()._open()
        latestWs()._message({ type: 'pong' })

        expect(cb).not.toHaveBeenCalled()
    })

    it('unsubscribe function removes the listener', () => {
        localStorage.setItem('token', 'jwt-abc')
        const cb = vi.fn()
        const unsub = wsManager.on(cb)

        wsManager.connect()
        latestWs()._open()

        unsub()
        latestWs()._message({ event: 'pedido:updated', data: {} })

        expect(cb).not.toHaveBeenCalled()
    })

    it('onStatus unsubscribe stops notifications', () => {
        localStorage.setItem('token', 'jwt-abc')
        const cb = vi.fn()
        const unsub = wsManager.onStatus(cb)

        wsManager.connect()
        unsub()
        latestWs()._open()

        expect(cb).not.toHaveBeenCalled()
    })
})

describe('WsManager – reconnection', () => {
    it('schedules reconnect with exponential backoff on close', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        // Simulate close → should schedule reconnect at 1s
        latestWs()._close()
        expect(mockWsInstances).toHaveLength(1)

        vi.advanceTimersByTime(1000)
        expect(mockWsInstances).toHaveLength(2)

        // Second close → backoff doubles to 2s
        latestWs()._close()
        vi.advanceTimersByTime(1500)
        expect(mockWsInstances).toHaveLength(2) // not yet

        vi.advanceTimersByTime(600)
        expect(mockWsInstances).toHaveLength(3) // now at ~2s
    })

    it('caps backoff at 30 seconds', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        // Force backoff to max
        wsManager._backoff = 30000
        latestWs()._close()

        vi.advanceTimersByTime(29999)
        const countBefore = mockWsInstances.length
        vi.advanceTimersByTime(2)
        expect(mockWsInstances.length).toBe(countBefore + 1)
    })

    it('disconnect cancels pending reconnect', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()
        latestWs()._close()

        wsManager.disconnect()
        vi.advanceTimersByTime(5000)
        expect(mockWsInstances).toHaveLength(1)
    })
})

describe('WsManager – visibility change', () => {
    it('reconnects immediately when page becomes visible and disconnected', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()
        latestWs()._close()

        wsManager.disconnect()
        const countBefore = mockWsInstances.length

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))

        expect(mockWsInstances.length).toBe(countBefore + 1)
    })

    it('does not reconnect when page becomes visible but already connected', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        const countBefore = mockWsInstances.length

        Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
        document.dispatchEvent(new Event('visibilitychange'))

        expect(mockWsInstances.length).toBe(countBefore)
    })
})

describe('WsManager – heartbeat', () => {
    it('sends ping every 25 seconds when connected', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        const ws = latestWs()
        expect(ws.send).not.toHaveBeenCalled()

        vi.advanceTimersByTime(25000)
        expect(ws.send).toHaveBeenCalledTimes(1)
        expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({ type: 'ping' })

        vi.advanceTimersByTime(25000)
        expect(ws.send).toHaveBeenCalledTimes(2)
    })

    it('stops ping after disconnect', () => {
        localStorage.setItem('token', 'jwt-abc')
        wsManager.connect()
        latestWs()._open()

        const ws = latestWs()
        wsManager.disconnect()

        vi.advanceTimersByTime(50000)
        expect(ws.send).not.toHaveBeenCalled()
    })
})
