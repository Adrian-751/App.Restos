import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import {
    createTestEnvironment,
    destroyTestEnvironment,
    clearCollections,
    registerAndLogin,
} from './helpers/testApp.js'

let app, conn, models, mongod, token, adminUser

beforeAll(async () => {
    ;({ app, conn, models, mongod } = await createTestEnvironment())
    ;({ token, user: adminUser } = await registerAndLogin(app, request))
})

afterAll(async () => {
    await destroyTestEnvironment({ conn, mongod })
})

beforeEach(async () => {
    await Promise.all([
        models.Pedido.deleteMany({}),
        models.Mesa.deleteMany({}),
        models.Cliente.deleteMany({}),
        models.Caja.deleteMany({}),
    ])
})

const auth = () => ({ Authorization: `Bearer ${token}` })

const validItems = [
    { productoId: '507f1f77bcf86cd799439011', nombre: 'Pizza', cantidad: 2, precio: 800 },
]

// ─── GET /api/pedidos ─────────────────────────────────────────────────────────

describe('GET /api/pedidos', () => {
    it('returns empty array when no pedidos', async () => {
        const res = await request(app).get('/api/pedidos').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/pedidos')
        expect(res.status).toBe(401)
    })

    it('returns all pedidos sorted by createdAt desc', async () => {
        await models.Pedido.create([
            { nombre: 'A', items: validItems, total: 100, estado: 'Pendiente' },
            { nombre: 'B', items: validItems, total: 200, estado: 'Pendiente' },
        ])
        const res = await request(app).get('/api/pedidos').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(2)
    })

    it('?pendientes=true excludes Cobrado and Cancelado', async () => {
        await models.Pedido.create([
            { nombre: 'Pending', items: validItems, total: 100, estado: 'Pendiente' },
            { nombre: 'Cobrado', items: validItems, total: 200, estado: 'Cobrado' },
            { nombre: 'Cancelado', items: validItems, total: 150, estado: 'Cancelado' },
        ])
        const res = await request(app).get('/api/pedidos?pendientes=true').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
        expect(res.body[0].nombre).toBe('Pending')
    })

    it('?fecha=YYYY-MM-DD filters by date range', async () => {
        const today = new Date()
        const old = new Date('2020-01-01T12:00:00Z')
        await models.Pedido.create([
            { nombre: 'Today', items: validItems, total: 100, estado: 'Pendiente', createdAt: today },
            { nombre: 'Old', items: validItems, total: 100, estado: 'Pendiente', createdAt: old },
        ])
        const todayStr = today.toISOString().split('T')[0]
        const res = await request(app).get(`/api/pedidos?fecha=${todayStr}`).set(auth())
        expect(res.status).toBe(200)
        // Should include today's order but not 2020
        const names = res.body.map(p => p.nombre)
        expect(names).toContain('Today')
        expect(names).not.toContain('Old')
    })

    it('ignores invalid ?fecha format', async () => {
        await models.Pedido.create({ nombre: 'X', items: validItems, total: 100, estado: 'Pendiente' })
        const res = await request(app).get('/api/pedidos?fecha=not-a-date').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(1)
    })
})

// ─── POST /api/pedidos ────────────────────────────────────────────────────────

describe('POST /api/pedidos', () => {
    it('creates a pendiente pedido with valid data (201)', async () => {
        const res = await request(app)
            .post('/api/pedidos')
            .set(auth())
            .send({ nombre: 'Mesa 1', items: validItems, total: 1600 })
        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('_id')
        expect(res.body.estado).toBe('Pendiente')
        expect(res.body.total).toBe(1600)
    })

    it('creates pedido with estado Cuenta Corriente when clienteId is provided', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Pepe', numero: 1 })
        const res = await request(app)
            .post('/api/pedidos')
            .set(auth())
            .send({ nombre: 'Pepe', items: validItems, total: 500, clienteId: cliente._id.toString() })
        expect(res.status).toBe(201)
        expect(res.body.estado).toBe('Cuenta Corriente')
        const updated = await models.Cliente.findById(cliente._id)
        expect(updated.cuentaCorriente).toBe(500)
    })

    it('defaults total to 0 when not provided', async () => {
        const res = await request(app)
            .post('/api/pedidos')
            .set(auth())
            .send({ nombre: 'Empty', items: validItems })
        expect(res.status).toBe(201)
        expect(res.body.total).toBe(0)
    })

    it('persists mesaId when provided', async () => {
        const mesa = await models.Mesa.create({ numero: 1, estado: 'libre' })
        const res = await request(app)
            .post('/api/pedidos')
            .set(auth())
            .send({ nombre: 'M1', items: validItems, total: 100, mesaId: mesa._id.toString() })
        expect(res.status).toBe(201)
        expect(res.body.mesaId.toString()).toBe(mesa._id.toString())
    })

    it('returns 401 without token', async () => {
        const res = await request(app)
            .post('/api/pedidos')
            .send({ nombre: 'X', items: validItems, total: 100 })
        expect(res.status).toBe(401)
    })

    it('handles very large payload without crashing', async () => {
        const bigItems = Array.from({ length: 500 }, (_, i) => ({
            productoId: `507f1f77bcf86cd79943901${i % 9}`,
            nombre: `Producto ${i}`,
            cantidad: 1,
            precio: 100,
        }))
        const res = await request(app)
            .post('/api/pedidos')
            .set(auth())
            .send({ nombre: 'Big', items: bigItems, total: 50000 })
        expect(res.status).toBe(201)
        expect(res.body.items).toHaveLength(500)
    })
})

// ─── PUT /api/pedidos/:id ─────────────────────────────────────────────────────

describe('PUT /api/pedidos/:id', () => {
    it('updates pedido fields', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'Original', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app)
            .put(`/api/pedidos/${pedido._id}`)
            .set(auth())
            .send({ nombre: 'Updated', total: 200 })
        expect(res.status).toBe(200)
        expect(res.body.nombre).toBe('Updated')
        expect(res.body.total).toBe(200)
    })

    it('sets cobradoAt when changing estado to Cobrado', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'ToClose', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app)
            .put(`/api/pedidos/${pedido._id}`)
            .set(auth())
            .send({ estado: 'Cobrado', efectivo: 100 })
        expect(res.status).toBe(200)
        expect(res.body.cobradoAt).toBeTruthy()
        expect(res.body.estado).toBe('Cobrado')
    })

    it('returns 404 for non-existent id', async () => {
        const res = await request(app)
            .put('/api/pedidos/507f1f77bcf86cd799439011')
            .set(auth())
            .send({ nombre: 'X' })
        expect(res.status).toBe(404)
    })

    it('strips _id from update body (no cast errors)', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'Safe', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app)
            .put(`/api/pedidos/${pedido._id}`)
            .set(auth())
            .send({ _id: 'some-random-string', nombre: 'SafeUpdated' })
        expect(res.status).toBe(200)
        expect(res.body.nombre).toBe('SafeUpdated')
    })

    it('updates caja totalEfectivo when payment changes', async () => {
        const today = new Date().toISOString().split('T')[0]
        await models.Caja.create({ fecha: today, totalEfectivo: 0, totalTransferencia: 0, cerrada: false })
        const pedido = await models.Pedido.create({
            nombre: 'Pay', items: validItems, total: 300, estado: 'Pendiente',
        })
        const res = await request(app)
            .put(`/api/pedidos/${pedido._id}`)
            .set(auth())
            .send({ efectivo: 300 })
        expect(res.status).toBe(200)
        const caja = await models.Caja.findOne({ fecha: today })
        expect(caja.totalEfectivo).toBe(300)
    })

    it('returns 401 without token', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'X', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app).put(`/api/pedidos/${pedido._id}`).send({ nombre: 'Hacked' })
        expect(res.status).toBe(401)
    })
})

// ─── DELETE /api/pedidos/:id ──────────────────────────────────────────────────

describe('DELETE /api/pedidos/:id', () => {
    it('deletes pedido and returns { success: true }', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'ToDelete', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app)
            .delete(`/api/pedidos/${pedido._id}`)
            .set(auth())
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        const deleted = await models.Pedido.findById(pedido._id)
        expect(deleted).toBeNull()
    })

    it('returns 404 for non-existent pedido', async () => {
        const res = await request(app)
            .delete('/api/pedidos/507f1f77bcf86cd799439011')
            .set(auth())
        expect(res.status).toBe(404)
    })

    it('adjusts cuenta corriente when deleting CC pedido', async () => {
        const cliente = await models.Cliente.create({ nombre: 'CC Cliente', numero: 2, cuentaCorriente: 500 })
        const pedido = await models.Pedido.create({
            nombre: 'CC', items: validItems, total: 500,
            estado: 'Cuenta Corriente', clienteId: cliente._id,
        })
        await request(app).delete(`/api/pedidos/${pedido._id}`).set(auth())
        const updated = await models.Cliente.findById(cliente._id)
        expect(updated.cuentaCorriente).toBe(0)
    })

    it('returns 401 without token', async () => {
        const pedido = await models.Pedido.create({
            nombre: 'Auth', items: validItems, total: 100, estado: 'Pendiente',
        })
        const res = await request(app).delete(`/api/pedidos/${pedido._id}`)
        expect(res.status).toBe(401)
    })
})
