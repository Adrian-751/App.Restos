import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveTenant, tenantMiddleware } from '../../../tenancy/tenant.js'

const makeReq = (headers = {}, query = {}) => ({ headers, query })

describe('resolveTenant()', () => {
    afterEach(() => {
        delete process.env.DEFAULT_TENANT
    })

    it('uses X-Tenant header when present', () => {
        expect(resolveTenant(makeReq({ 'x-tenant': 'cliente1' }))).toBe('cliente1')
    })

    it('normalizes X-Tenant to lowercase and strips special chars', () => {
        expect(resolveTenant(makeReq({ 'x-tenant': 'Cliente_Uno!' }))).toBe('clienteuno')
    })

    it('falls back to DEFAULT_TENANT env when on localhost', () => {
        process.env.DEFAULT_TENANT = 'mi-negocio'
        const req = makeReq({ host: 'localhost:3000' })
        expect(resolveTenant(req)).toBe('mi-negocio')
    })

    it('falls back to "default" when on localhost with no env', () => {
        const req = makeReq({ host: 'localhost:3000' })
        expect(resolveTenant(req)).toBe('default')
    })

    it('returns "default" for 127.0.0.1', () => {
        const req = makeReq({ host: '127.0.0.1:3000' })
        expect(resolveTenant(req)).toBe('default')
    })

    it('accepts tenant via query param on localhost', () => {
        const req = makeReq({ host: 'localhost' }, { tenant: 'dev-tenant' })
        expect(resolveTenant(req)).toBe('dev-tenant')
    })

    it('extracts first subdomain from production host', () => {
        const req = makeReq({ host: 'acme.app-restos.com' })
        expect(resolveTenant(req)).toBe('acme')
    })

    it('uses DEFAULT_TENANT for root domain (no subdomain)', () => {
        process.env.DEFAULT_TENANT = 'root'
        const req = makeReq({ host: 'app-restos.com' })
        expect(resolveTenant(req)).toBe('root')
    })

    it('header overrides subdomain', () => {
        const req = makeReq({ 'x-tenant': 'override', host: 'acme.app-restos.com' })
        expect(resolveTenant(req)).toBe('override')
    })

    it('returns "default" when no host and no header', () => {
        const req = makeReq({})
        expect(resolveTenant(req)).toBe('default')
    })
})

describe('tenantMiddleware', () => {
    it('sets req.tenant and calls next()', () => {
        const req = makeReq({ 'x-tenant': 'test-co' })
        const next = vi.fn()
        tenantMiddleware(req, {}, next)
        expect(req.tenant).toBe('test-co')
        expect(next).toHaveBeenCalled()
    })
})
