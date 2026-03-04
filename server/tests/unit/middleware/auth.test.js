import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { authenticate, authorize, isAdmin } from '../../../middleware/auth.js'

const JWT_SECRET = 'test_secret'

beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET
    process.env.AUTH_ENABLED = 'true'
    process.env.AUTH_REQUIRED = 'true'
})

const makeReq = (overrides = {}) => ({
    headers: {},
    models: null,
    tenant: 'test',
    ...overrides,
})

const mockRes = () => {
    const res = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    return res
}

describe('authenticate middleware', () => {
    it('returns 401 when no Authorization header and auth is required', async () => {
        const req = makeReq({ headers: {} })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(next).not.toHaveBeenCalled()
    })

    it('calls next() when no token and AUTH_REQUIRED=false', async () => {
        process.env.AUTH_REQUIRED = 'false'
        const req = makeReq({ headers: {} })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(next).toHaveBeenCalled()
        expect(req.userId).toBeNull()
    })

    it('returns 401 for malformed Bearer token', async () => {
        const req = makeReq({ headers: { authorization: 'Bearer INVALID_TOKEN' } })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Token inválido' })
        )
    })

    it('returns 401 for expired token', async () => {
        const expired = jwt.sign({ userId: 'abc', tenant: 'test' }, JWT_SECRET, { expiresIn: '-1s' })
        const req = makeReq({ headers: { authorization: `Bearer ${expired}` } })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Token expirado' })
        )
    })

    it('returns 500 when req.models is not set', async () => {
        const token = jwt.sign({ userId: 'abc', tenant: 'test' }, JWT_SECRET)
        const req = makeReq({
            headers: { authorization: `Bearer ${token}` },
            models: null,
        })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(500)
    })

    it('returns 401 when token tenant mismatches request tenant', async () => {
        const token = jwt.sign({ userId: 'abc', tenant: 'other-tenant' }, JWT_SECRET)
        const req = makeReq({
            headers: { authorization: `Bearer ${token}` },
            tenant: 'test',
            models: { User: { findById: vi.fn() } },
        })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Token no corresponde a este cliente' })
        )
    })

    it('returns 401 when user not found in DB', async () => {
        const token = jwt.sign({ userId: 'abc', tenant: 'test' }, JWT_SECRET)
        const req = makeReq({
            headers: { authorization: `Bearer ${token}` },
            tenant: 'test',
            models: { User: { findById: vi.fn().mockResolvedValue(null) } },
        })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns 401 when user is inactive', async () => {
        const token = jwt.sign({ userId: 'abc', tenant: 'test' }, JWT_SECRET)
        const req = makeReq({
            headers: { authorization: `Bearer ${token}` },
            tenant: 'test',
            models: {
                User: {
                    findById: vi.fn().mockResolvedValue({ _id: 'abc', activo: false, role: 'admin' }),
                },
            },
        })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('sets req.userId, req.userRole, req.user and calls next() for valid token', async () => {
        const token = jwt.sign({ userId: 'abc123', tenant: 'test' }, JWT_SECRET)
        const fakeUser = { _id: 'abc123', activo: true, role: 'admin' }
        const req = makeReq({
            headers: { authorization: `Bearer ${token}` },
            tenant: 'test',
            models: { User: { findById: vi.fn().mockResolvedValue(fakeUser) } },
        })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(next).toHaveBeenCalled()
        expect(req.userId).toBe('abc123')
        expect(req.userRole).toBe('admin')
        expect(req.user).toBe(fakeUser)
    })

    it('bypasses auth entirely when AUTH_ENABLED=false', async () => {
        process.env.AUTH_ENABLED = 'false'
        const req = makeReq({ headers: {} })
        const res = mockRes()
        const next = vi.fn()
        await authenticate(req, res, next)
        expect(next).toHaveBeenCalled()
        expect(req.userId).toBeNull()
    })
})

describe('authorize middleware', () => {
    it('returns 401 when req.userRole is not set', () => {
        const middleware = authorize('admin')
        const req = { userRole: null }
        const res = mockRes()
        const next = vi.fn()
        middleware(req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('returns 403 when role is not in allowed list', () => {
        const middleware = authorize('admin')
        const req = { userRole: 'mesero' }
        const res = mockRes()
        const next = vi.fn()
        middleware(req, res, next)
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it('calls next() when role is allowed', () => {
        const middleware = authorize('admin', 'cajero')
        const req = { userRole: 'cajero' }
        const res = mockRes()
        const next = vi.fn()
        middleware(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    it('isAdmin alias works correctly for admin role', () => {
        const req = { userRole: 'admin' }
        const res = mockRes()
        const next = vi.fn()
        isAdmin(req, res, next)
        expect(next).toHaveBeenCalled()
    })

    it('isAdmin alias returns 403 for non-admin', () => {
        const req = { userRole: 'mesero' }
        const res = mockRes()
        const next = vi.fn()
        isAdmin(req, res, next)
        expect(res.status).toHaveBeenCalledWith(403)
    })
})
