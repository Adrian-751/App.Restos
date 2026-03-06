import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import {
    createTestEnvironment,
    destroyTestEnvironment,
    clearCollections,
    registerAndLogin,
} from './helpers/testApp.js'

let app, conn, models, mongod, token

beforeAll(async () => {
    ;({ app, conn, models, mongod } = await createTestEnvironment())
    ;({ token } = await registerAndLogin(app, request))
})

afterAll(async () => {
    await destroyTestEnvironment({ conn, mongod })
})

beforeEach(async () => {
    await models.Caja.deleteMany({})
    await models.Mesa.deleteMany({})
})

const auth = () => ({ Authorization: `Bearer ${token}` })
const today = () => new Date().toISOString().split('T')[0]

// ─── GET /api/caja/estado ─────────────────────────────────────────────────────

describe('GET /api/caja/estado', () => {
    it('returns null when no open caja exists', async () => {
        const res = await request(app).get('/api/caja/estado').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toBeNull()
    })

    it('returns open caja when one exists', async () => {
        const caja = await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 0, totalTransferencia: 0 })
        const res = await request(app).get('/api/caja/estado').set(auth())
        expect(res.status).toBe(200)
        expect(res.body._id).toBe(caja._id.toString())
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/caja/estado')
        expect(res.status).toBe(401)
    })
})

// ─── POST /api/caja/abrir ─────────────────────────────────────────────────────

describe('POST /api/caja/abrir', () => {
    it('creates a new caja with montoInicial (201)', async () => {
        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ montoInicial: 1000, fecha: today() })
        expect(res.status).toBe(201)
        expect(res.body.montoInicial).toBe(1000)
        expect(res.body.cerrada).toBe(false)
    })

    it('creates caja with montoInicial 0 when not provided', async () => {
        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today() })
        expect(res.status).toBe(201)
        expect(res.body.montoInicial).toBe(0)
    })

    it('rejects opening when another caja is open (permitirMultiples=false)', async () => {
        await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 0, totalTransferencia: 0 })
        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today() })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/Ya existe una caja abierta/)
    })

    it('returns existing open caja with permitirMultiples=true for same date', async () => {
        const existing = await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 0, totalTransferencia: 0 })
        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today(), permitirMultiples: true })
        expect(res.status).toBe(200)
        expect(res.body._id).toBe(existing._id.toString())
    })

    it('reopens a closed caja when one exists for that date', async () => {
        await models.Caja.create({ fecha: today(), cerrada: true, totalEfectivo: 500, totalTransferencia: 200 })
        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today() })
        expect(res.status).toBe(200)
        expect(res.body.cerrada).toBe(false)
        expect(res.body.totalEfectivo).toBe(500)
    })

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/caja/abrir').send({ fecha: today() })
        expect(res.status).toBe(401)
    })
})

// ─── POST /api/caja/cerrar ────────────────────────────────────────────────────

describe('POST /api/caja/cerrar', () => {
    it('closes an open caja and sets cerradaAt', async () => {
        const caja = await models.Caja.create({
            fecha: today(), cerrada: false, totalEfectivo: 500, totalTransferencia: 300,
        })
        const res = await request(app)
            .post('/api/caja/cerrar')
            .set(auth())
            .send({ id: caja._id.toString() })
        expect(res.status).toBe(200)
        expect(res.body.cerrada).toBe(true)
        expect(res.body.cerradaAt).toBeTruthy()
        expect(res.body.totalDia).toBe(800)
    })

    it('returns 400 when caja is already closed', async () => {
        const caja = await models.Caja.create({
            fecha: today(), cerrada: true, totalEfectivo: 0, totalTransferencia: 0,
        })
        const res = await request(app)
            .post('/api/caja/cerrar')
            .set(auth())
            .send({ id: caja._id.toString() })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('La caja ya está cerrada')
    })

    it('returns 404 for non-existent caja id', async () => {
        const res = await request(app)
            .post('/api/caja/cerrar')
            .set(auth())
            .send({ id: '507f1f77bcf86cd799439011' })
        expect(res.status).toBe(404)
    })

    it('clears mesa nombres when closing today\'s caja', async () => {
        const caja = await models.Caja.create({ fecha: today(), cerrada: false })
        await models.Mesa.create([
            { numero: 1, nombre: 'Juan', estado: 'ocupada' },
            { numero: 2, nombre: 'Pedro', estado: 'libre' },
        ])
        await request(app).post('/api/caja/cerrar').set(auth()).send({ id: caja._id.toString() })
        const mesas = await models.Mesa.find({})
        expect(mesas.every(m => m.nombre === '')).toBe(true)
    })
})

// ─── POST /api/caja/egreso ────────────────────────────────────────────────────

describe('POST /api/caja/egreso', () => {
    it('registers an egreso in the open caja (201)', async () => {
        await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 1000, totalTransferencia: 0 })
        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ efectivo: 200, observaciones: 'Limpieza' })
        expect(res.status).toBe(201)
        expect(res.body.egresos).toHaveLength(1)
        expect(res.body.egresos[0].efectivo).toBe(200)
        expect(res.body.egresos[0].observaciones).toBe('Limpieza')
    })

    it('returns 400 when no caja is open', async () => {
        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ efectivo: 100 })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('No hay una caja abierta')
    })

    it('returns 400 for negative amounts', async () => {
        await models.Caja.create({ fecha: today(), cerrada: false })
        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ efectivo: -50 })
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('Montos inválidos')
    })

    it('returns 400 when both efectivo and transferencia are 0', async () => {
        await models.Caja.create({ fecha: today(), cerrada: false })
        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ efectivo: 0, transferencia: 0 })
        expect(res.status).toBe(400)
    })
})

// ─── GET /api/caja/resumen/:fecha ─────────────────────────────────────────────

describe('GET /api/caja/resumen/:fecha', () => {
    it('returns cajas for a specific date', async () => {
        await models.Caja.create({ fecha: '2026-03-04', cerrada: true, totalEfectivo: 500, totalTransferencia: 200 })
        const res = await request(app).get('/api/caja/resumen/2026-03-04').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0].fecha).toBe('2026-03-04')
    })

    it('returns empty array for date with no cajas', async () => {
        const res = await request(app).get('/api/caja/resumen/2020-01-01').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })
})

// ─── GET /api/caja/todas ──────────────────────────────────────────────────────

describe('GET /api/caja/todas', () => {
    it('returns all cajas', async () => {
        await models.Caja.create([
            { fecha: '2026-03-01', cerrada: true, totalEfectivo: 0, totalTransferencia: 0 },
            { fecha: '2026-03-02', cerrada: false, totalEfectivo: 0, totalTransferencia: 0 },
        ])
        const res = await request(app).get('/api/caja/todas').set(auth())
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThanOrEqual(2)
    })

    it('filters by ?cerradas=true', async () => {
        await models.Caja.create([
            { fecha: '2026-03-01', cerrada: true },
            { fecha: '2026-03-02', cerrada: false },
        ])
        const res = await request(app).get('/api/caja/todas?cerradas=true').set(auth())
        expect(res.status).toBe(200)
        expect(res.body.every(c => c.cerrada === true)).toBe(true)
    })

    it('filters by ?cerradas=false', async () => {
        await models.Caja.create([
            { fecha: '2026-03-03', cerrada: true },
            { fecha: '2026-03-04', cerrada: false },
        ])
        const res = await request(app).get('/api/caja/todas?cerradas=false').set(auth())
        expect(res.status).toBe(200)
        expect(res.body.every(c => c.cerrada === false)).toBe(true)
    })

    it('returns an empty array (never null) when no cajas exist', async () => {
        const res = await request(app).get('/api/caja/todas').set(auth())
        expect(res.status).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
    })
})

// ─── Regression: cerrar + reabrir conserva todos los montos ───────────────────
// Reproduce el bug de producción: la caja volvía a 0 cuando el usuario cerraba
// y reabría. El backend debe preservar totalEfectivo, totalTransferencia y
// egresos al reabrir una caja cerrada.

describe('Regression: close + reopen preserves totals', () => {
    it('reopening a closed caja preserves totalEfectivo, totalTransferencia, montoInicial and egresos', async () => {
        const caja = await models.Caja.create({
            fecha: today(),
            cerrada: false,
            montoInicial: 500,
            totalEfectivo: 1500,
            totalTransferencia: 800,
            egresos: [{ efectivo: 100, transferencia: 0, observaciones: 'Limpieza' }],
        })

        await request(app).post('/api/caja/cerrar').set(auth()).send({ id: caja._id.toString() })

        const reopenRes = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today() })

        expect(reopenRes.status).toBe(200)
        expect(reopenRes.body.cerrada).toBe(false)
        expect(reopenRes.body.totalEfectivo).toBe(1500)
        expect(reopenRes.body.totalTransferencia).toBe(800)
        expect(reopenRes.body.montoInicial).toBe(500)
        expect(reopenRes.body.egresos).toHaveLength(1)
        expect(reopenRes.body.egresos[0].efectivo).toBe(100)
    })

    it('does NOT reset montoInicial when reopening without providing it in body', async () => {
        await models.Caja.create({
            fecha: today(),
            cerrada: true,
            montoInicial: 1200,
            totalEfectivo: 400,
            totalTransferencia: 0,
        })

        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today() }) // sin montoInicial

        expect(res.body.montoInicial).toBe(1200)
    })

    it('updates montoInicial only when explicitly provided on reopen', async () => {
        await models.Caja.create({
            fecha: today(),
            cerrada: true,
            montoInicial: 1000,
            totalEfectivo: 0,
            totalTransferencia: 0,
        })

        const res = await request(app)
            .post('/api/caja/abrir')
            .set(auth())
            .send({ fecha: today(), montoInicial: 2500 })

        expect(res.body.montoInicial).toBe(2500)
    })
})

// ─── GET /api/caja/estado con múltiples cajas abiertas ────────────────────────

describe('GET /api/caja/estado - multiple open cajas', () => {
    it('returns the most recently created open caja when multiple exist', async () => {
        await models.Caja.create({ fecha: '2026-03-01', cerrada: false })
        await new Promise((r) => setTimeout(r, 20))
        const newer = await models.Caja.create({ fecha: today(), cerrada: false })

        const res = await request(app).get('/api/caja/estado').set(auth())
        expect(res.status).toBe(200)
        expect(res.body._id).toBe(newer._id.toString())
    })

    it('returns null (not 404) when no open cajas exist', async () => {
        await models.Caja.create({ fecha: today(), cerrada: true })
        const res = await request(app).get('/api/caja/estado').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toBeNull()
    })
})

// ─── POST /api/caja/egreso - apunta a la caja correcta por fecha ──────────────

describe('POST /api/caja/egreso - targets caja by fecha', () => {
    it('registers egreso in the caja matching the given fecha, not in the newest', async () => {
        const cajaVieja = await models.Caja.create({
            fecha: '2026-03-01',
            cerrada: false,
            totalEfectivo: 1000,
        })
        await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 500 })

        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ efectivo: 150, fecha: '2026-03-01' })

        expect(res.status).toBe(201)

        const updated = await models.Caja.findById(cajaVieja._id)
        expect(updated.egresos).toHaveLength(1)
        expect(updated.egresos[0].efectivo).toBe(150)

        const hoy = await models.Caja.findOne({ fecha: today() })
        expect(hoy.egresos).toHaveLength(0)
    })

    it('falls back to most recent open caja when no fecha is provided', async () => {
        await models.Caja.create({ fecha: '2026-03-01', cerrada: false, totalEfectivo: 200 })
        await new Promise((r) => setTimeout(r, 20))
        const newest = await models.Caja.create({ fecha: today(), cerrada: false, totalEfectivo: 500 })

        const res = await request(app)
            .post('/api/caja/egreso')
            .set(auth())
            .send({ transferencia: 75 })

        expect(res.status).toBe(201)
        const updated = await models.Caja.findById(newest._id)
        expect(updated.egresos).toHaveLength(1)
        expect(updated.egresos[0].transferencia).toBe(75)
    })
})
