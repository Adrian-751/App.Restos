import { WebSocketServer } from 'ws'
import jwt from 'jsonwebtoken'

// tenant -> Set<WebSocket>
const rooms = new Map()

/**
 * Attach a WebSocket server to an existing HTTP server.
 * Clients connect to /ws?token=JWT&tenant=TENANT_ID
 */
export function createWebSocketServer(httpServer) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

    wss.on('connection', (ws, req) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const token = url.searchParams.get('token')
        const tenant = url.searchParams.get('tenant') || 'default'

        // JWT authentication
        try {
            if (!token || !process.env.JWT_SECRET) {
                ws.close(4001, 'Unauthorized')
                return
            }
            const decoded = jwt.verify(token, process.env.JWT_SECRET)
            if (decoded?.tenant && decoded.tenant !== tenant) {
                ws.close(4001, 'Tenant mismatch')
                return
            }
            ws.tenant = tenant
            ws.userId = decoded.userId
        } catch {
            ws.close(4001, 'Invalid token')
            return
        }

        // Join tenant room
        if (!rooms.has(tenant)) rooms.set(tenant, new Set())
        rooms.get(tenant).add(ws)

        // Protocol-level heartbeat (ws ping/pong)
        ws.isAlive = true
        ws.on('pong', () => { ws.isAlive = true })

        // Application-level ping from client
        ws.on('message', (raw) => {
            try {
                const msg = JSON.parse(raw)
                if (msg.type === 'ping') {
                    ws.send(JSON.stringify({ type: 'pong' }))
                }
            } catch { /* ignore non-JSON */ }
        })

        ws.on('close', () => {
            const room = rooms.get(tenant)
            if (room) {
                room.delete(ws)
                if (room.size === 0) rooms.delete(tenant)
            }
        })

        ws.on('error', () => { /* swallow; 'close' will fire next */ })
    })

    // Protocol-level heartbeat: terminate dead connections every 30s
    const heartbeat = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (!ws.isAlive) return ws.terminate()
            ws.isAlive = false
            ws.ping()
        })
    }, 30_000)

    wss.on('close', () => clearInterval(heartbeat))

    return wss
}

/**
 * Send a message to every connected client in a tenant room.
 * Controllers call this after mutations so clients can refetch.
 */
export function broadcast(tenant, event, data) {
    if (!tenant) return
    const room = rooms.get(tenant)
    if (!room || room.size === 0) return

    const payload = JSON.stringify({ event, data, ts: Date.now() })
    for (const ws of room) {
        if (ws.readyState === 1) { // OPEN
            ws.send(payload)
        }
    }
}
