import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'http'
import jwt from 'jsonwebtoken'
import WebSocket from 'ws'
import { createWebSocketServer, broadcast } from '../../ws.js'

const JWT_SECRET = 'test-ws-secret'
let httpServer, wss, port
const openClients = []

function makeToken(payload = {}) {
    return jwt.sign({ userId: 'user1', tenant: 'test', ...payload }, JWT_SECRET)
}

function connectClient(query = {}) {
    const params = new URLSearchParams(query)
    const ws = new WebSocket(`ws://localhost:${port}/ws?${params}`)
    openClients.push(ws)
    return ws
}

function waitForOpen(ws) {
    if (ws.readyState === WebSocket.OPEN) return Promise.resolve()
    return new Promise((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
    })
}

function waitForClose(ws) {
    return new Promise((resolve) => ws.on('close', (code) => resolve(code)))
}

function waitForMessage(ws) {
    return new Promise((resolve) => {
        ws.once('message', (raw) => resolve(JSON.parse(raw.toString())))
    })
}

beforeAll(async () => {
    process.env.JWT_SECRET = JWT_SECRET
    httpServer = createServer()
    wss = createWebSocketServer(httpServer)
    await new Promise((resolve) => httpServer.listen(0, resolve))
    port = httpServer.address().port
})

afterEach(async () => {
    for (const ws of openClients) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close()
        }
    }
    openClients.length = 0
    await new Promise((r) => setTimeout(r, 50))
})

afterAll(async () => {
    wss.close()
    await new Promise((resolve) => httpServer.close(resolve))
})

// ─── Connection authentication ──────────────────────────────────────────────

describe('WebSocket connection auth', () => {
    it('rejects connection without token (code 4001)', async () => {
        const ws = connectClient({ tenant: 'test' })
        const code = await waitForClose(ws)
        expect(code).toBe(4001)
    })

    it('rejects connection with invalid JWT (code 4001)', async () => {
        const ws = connectClient({ token: 'bad.jwt.token', tenant: 'test' })
        const code = await waitForClose(ws)
        expect(code).toBe(4001)
    })

    it('rejects connection when token tenant mismatches query tenant', async () => {
        const token = makeToken({ tenant: 'tenant-a' })
        const ws = connectClient({ token, tenant: 'tenant-b' })
        const code = await waitForClose(ws)
        expect(code).toBe(4001)
    })

    it('rejects connection when JWT_SECRET is missing', async () => {
        const saved = process.env.JWT_SECRET
        delete process.env.JWT_SECRET
        const ws = connectClient({ token: 'whatever', tenant: 'test' })
        const code = await waitForClose(ws)
        expect(code).toBe(4001)
        process.env.JWT_SECRET = saved
    })

    it('accepts connection with valid JWT and matching tenant', async () => {
        const token = makeToken({ tenant: 'test' })
        const ws = connectClient({ token, tenant: 'test' })
        await waitForOpen(ws)
        expect(ws.readyState).toBe(WebSocket.OPEN)
    })

    it('accepts connection when token has no tenant field (no mismatch check)', async () => {
        const token = jwt.sign({ userId: 'u1' }, JWT_SECRET)
        const ws = connectClient({ token, tenant: 'any-tenant' })
        await waitForOpen(ws)
        expect(ws.readyState).toBe(WebSocket.OPEN)
    })
})

// ─── Application-level ping/pong ────────────────────────────────────────────

describe('WebSocket ping/pong', () => {
    it('responds to application-level ping with pong', async () => {
        const token = makeToken()
        const ws = connectClient({ token, tenant: 'test' })
        await waitForOpen(ws)

        const msgPromise = waitForMessage(ws)
        ws.send(JSON.stringify({ type: 'ping' }))
        const msg = await msgPromise

        expect(msg).toEqual({ type: 'pong' })
    })

    it('ignores non-JSON messages without crashing', async () => {
        const token = makeToken()
        const ws = connectClient({ token, tenant: 'test' })
        await waitForOpen(ws)
        ws.send('not json at all')
        await new Promise((r) => setTimeout(r, 50))
        expect(ws.readyState).toBe(WebSocket.OPEN)
    })
})

// ─── Broadcast ──────────────────────────────────────────────────────────────

describe('broadcast', () => {
    it('does not throw for null tenant', () => {
        expect(() => broadcast(null, 'test', {})).not.toThrow()
    })

    it('does not throw for undefined tenant', () => {
        expect(() => broadcast(undefined, 'test', {})).not.toThrow()
    })

    it('does not throw for non-existent tenant', () => {
        expect(() => broadcast('ghost-tenant-999', 'test', {})).not.toThrow()
    })

    it('delivers message to all clients in the same tenant room', async () => {
        const tenant = 'broadcast-same'
        const token = makeToken({ tenant })

        const ws1 = connectClient({ token, tenant })
        const ws2 = connectClient({ token, tenant })
        await Promise.all([waitForOpen(ws1), waitForOpen(ws2)])

        const p1 = waitForMessage(ws1)
        const p2 = waitForMessage(ws2)

        broadcast(tenant, 'pedido:created', { _id: 'abc' })

        const [msg1, msg2] = await Promise.all([p1, p2])

        expect(msg1.event).toBe('pedido:created')
        expect(msg1.data).toEqual({ _id: 'abc' })
        expect(msg1.ts).toBeTypeOf('number')

        expect(msg2.event).toBe('pedido:created')
        expect(msg2.data).toEqual({ _id: 'abc' })
    })

    it('does NOT deliver messages to clients in other tenants', async () => {
        const tokenA = makeToken({ tenant: 'iso-a' })
        const tokenB = makeToken({ tenant: 'iso-b' })

        const wsA = connectClient({ token: tokenA, tenant: 'iso-a' })
        const wsB = connectClient({ token: tokenB, tenant: 'iso-b' })
        await Promise.all([waitForOpen(wsA), waitForOpen(wsB)])

        let receivedB = false
        wsB.on('message', () => { receivedB = true })

        const pA = waitForMessage(wsA)
        broadcast('iso-a', 'pedido:updated', { _id: 'x' })

        const msgA = await pA
        expect(msgA.event).toBe('pedido:updated')

        await new Promise((r) => setTimeout(r, 100))
        expect(receivedB).toBe(false)
    })

    it('cleans up room when last client disconnects', async () => {
        const tenant = 'cleanup-test'
        const token = makeToken({ tenant })
        const ws = connectClient({ token, tenant })
        await waitForOpen(ws)

        ws.close()
        await new Promise((r) => setTimeout(r, 100))

        expect(() => broadcast(tenant, 'test', {})).not.toThrow()
    })

    it('still delivers to remaining clients after one disconnects', async () => {
        const tenant = 'partial-dc'
        const token = makeToken({ tenant })

        const ws1 = connectClient({ token, tenant })
        const ws2 = connectClient({ token, tenant })
        await Promise.all([waitForOpen(ws1), waitForOpen(ws2)])

        ws1.close()
        await new Promise((r) => setTimeout(r, 50))

        const p2 = waitForMessage(ws2)
        broadcast(tenant, 'pedido:deleted', { _id: 'd1' })

        const msg = await p2
        expect(msg.event).toBe('pedido:deleted')
        expect(msg.data._id).toBe('d1')
    })
})
