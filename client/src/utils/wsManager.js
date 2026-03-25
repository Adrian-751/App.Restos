/**
 * Singleton WebSocket manager with:
 * - JWT + tenant authentication
 * - Automatic reconnection with exponential backoff (1s → 30s)
 * - Immediate reconnection on visibility change (screen wake)
 * - Application-level heartbeat (ping every 25s)
 *
 * Usage:
 *   wsManager.connect()                       // initiate connection
 *   const unsub = wsManager.on(msg => { })    // subscribe to messages
 *   unsub()                                   // unsubscribe
 */

const isIPv4 = (host) => /^(\d{1,3}\.){3}\d{1,3}$/.test(host)

function getWsUrl() {
    if (import.meta.env.DEV) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${proto}//${window.location.host}/ws`
    }
    const apiUrl = import.meta.env.VITE_API_URL || 'https://app-restos-api.onrender.com/api'
    try {
        const url = new URL(apiUrl)
        url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
        url.pathname = '/ws'
        return url.toString()
    } catch {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        return `${proto}//${window.location.host}/ws`
    }
}

function getTenant() {
    const host = (window.location.hostname || '').toLowerCase()
    if (!host) return 'default'
    if (host === 'localhost' || host === '127.0.0.1' || isIPv4(host)) {
        const qp = new URL(window.location.href).searchParams.get('tenant')
        if (qp) return String(qp).trim().toLowerCase()
        const ls = localStorage.getItem('tenant')
        if (ls) return String(ls).trim().toLowerCase()
        return 'default'
    }
    const parts = host.split('.').filter(Boolean)
    return parts.length >= 3 ? parts[0] : 'default'
}

class WsManager {
    constructor() {
        this._ws = null
        this._listeners = new Set()
        this._statusListeners = new Set()
        this._backoff = 1000
        this._reconnectTimer = null
        this._pingInterval = null
        this._connected = false

        this._handleVisibility = () => {
            if (document.visibilityState === 'visible' && !this._connected) {
                this._clearReconnect()
                this._backoff = 1000
                this.connect()
            }
        }

        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', this._handleVisibility)
        }
    }

    get connected() { return this._connected }

    connect() {
        if (this._ws && (this._ws.readyState === WebSocket.CONNECTING || this._ws.readyState === WebSocket.OPEN)) {
            return
        }

        const token = localStorage.getItem('token')
        if (!token) return

        const tenant = getTenant()
        const url = `${getWsUrl()}?token=${encodeURIComponent(token)}&tenant=${encodeURIComponent(tenant)}`

        try {
            const ws = new WebSocket(url)
            this._ws = ws

            ws.onopen = () => {
                this._connected = true
                this._backoff = 1000
                this._notifyStatus()
                this._startPing()
            }

            ws.onmessage = (e) => {
                try {
                    const msg = JSON.parse(e.data)
                    if (msg.type === 'pong') return
                    for (const cb of this._listeners) {
                        try { cb(msg) } catch { /* consumer error */ }
                    }
                } catch { /* non-JSON */ }
            }

            ws.onclose = () => {
                this._connected = false
                this._ws = null
                this._stopPing()
                this._notifyStatus()
                this._scheduleReconnect()
            }

            ws.onerror = () => {
                ws.close()
            }
        } catch {
            this._scheduleReconnect()
        }
    }

    disconnect() {
        this._clearReconnect()
        this._stopPing()
        if (this._ws) {
            this._ws.onclose = null
            this._ws.close()
            this._ws = null
        }
        this._connected = false
        this._notifyStatus()
    }

    /** Subscribe to all incoming WS messages. Returns unsubscribe function. */
    on(callback) {
        this._listeners.add(callback)
        return () => this._listeners.delete(callback)
    }

    /** Subscribe to connection status changes (boolean). Returns unsubscribe function. */
    onStatus(callback) {
        this._statusListeners.add(callback)
        return () => this._statusListeners.delete(callback)
    }

    _notifyStatus() {
        for (const cb of this._statusListeners) {
            try { cb(this._connected) } catch { /* */ }
        }
    }

    _startPing() {
        this._stopPing()
        this._pingInterval = setInterval(() => {
            if (this._ws?.readyState === WebSocket.OPEN) {
                this._ws.send(JSON.stringify({ type: 'ping' }))
            }
        }, 25_000)
    }

    _stopPing() {
        if (this._pingInterval) {
            clearInterval(this._pingInterval)
            this._pingInterval = null
        }
    }

    _scheduleReconnect() {
        this._clearReconnect()
        this._reconnectTimer = setTimeout(() => {
            this._backoff = Math.min(this._backoff * 2, 30_000)
            this.connect()
        }, this._backoff)
    }

    _clearReconnect() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer)
            this._reconnectTimer = null
        }
    }
}

export const wsManager = new WsManager()
