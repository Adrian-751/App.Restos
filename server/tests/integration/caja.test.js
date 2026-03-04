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
})
