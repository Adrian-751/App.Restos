import { describe, it, expect, vi, beforeEach } from 'vitest'
import { errorHandler, asyncHandler } from '../../../middleware/errorHandler.js'

const mockRes = () => {
    const res = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    return res
}

const mockReq = () => ({ body: {}, params: {}, query: {} })
const mockNext = () => vi.fn()

describe('errorHandler middleware', () => {
    let res, req, next

    beforeEach(() => {
        res = mockRes()
        req = mockReq()
        next = mockNext()
        vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('handles Mongoose ValidationError with 400', () => {
        const err = { name: 'ValidationError', message: 'required', errors: {} }
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Error de validación' })
        )
    })

    it('handles Mongoose CastError with 400', () => {
        const err = { name: 'CastError', message: 'Cast to ObjectId failed' }
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(400)
    })

    it('handles MongoDB duplicate key error (code 11000) with 400', () => {
        const err = { code: 11000, keyPattern: { email: 1 } }
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ error: 'Dato duplicado' })
        )
    })

    it('handles JsonWebTokenError with 401', () => {
        const err = { name: 'JsonWebTokenError', message: 'invalid' }
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(401)
    })

    it('handles generic error with 500', () => {
        const err = new Error('Unexpected crash')
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(500)
    })

    it('uses err.status if provided', () => {
        const err = { message: 'Not found', status: 404 }
        errorHandler(err, req, res, next)
        expect(res.status).toHaveBeenCalledWith(404)
    })

    it('exposes stack trace in development only', () => {
        process.env.NODE_ENV = 'development'
        const err = new Error('Dev error')
        errorHandler(err, req, res, next)
        const call = res.json.mock.calls[0][0]
        expect(call).toHaveProperty('stack')

        process.env.NODE_ENV = 'test'
        res = mockRes()
        errorHandler(err, req, res, next)
        expect(res.json.mock.calls[0][0]).not.toHaveProperty('stack')
    })
})

describe('asyncHandler wrapper', () => {
    it('calls next(err) when async function throws', async () => {
        const err = new Error('async boom')
        const handler = asyncHandler(async (_req, _res, _next) => {
            throw err
        })
        const next = vi.fn()
        await handler({}, {}, next)
        expect(next).toHaveBeenCalledWith(err)
    })

    it('does not call next when async function resolves', async () => {
        const handler = asyncHandler(async (_req, res) => {
            res.json({ ok: true })
        })
        const res = mockRes()
        const next = vi.fn()
        await handler({}, res, next)
        expect(next).not.toHaveBeenCalled()
        expect(res.json).toHaveBeenCalledWith({ ok: true })
    })
})
