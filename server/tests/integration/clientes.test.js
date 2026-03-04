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
    await models.Cliente.deleteMany({})
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/clientes', () => {
    it('returns empty array initially', async () => {
        const res = await request(app).get('/api/clientes').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns all clientes', async () => {
        await models.Cliente.create([{ nombre: 'Ana', numero: 1 }, { nombre: 'Bob', numero: 2 }])
        const res = await request(app).get('/api/clientes').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(2)
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/clientes')
        expect(res.status).toBe(401)
    })
})

describe('POST /api/clientes', () => {
    it('creates a client (201)', async () => {
        const res = await request(app)
            .post('/api/clientes')
            .set(auth())
            .send({ nombre: 'Carlos López', contacto: '1155551234' })
        expect(res.status).toBe(201)
        expect(res.body.nombre).toBe('Carlos López')
        expect(res.body.cuentaCorriente).toBe(0)
    })

    it('rejects nombre shorter than 2 chars with 400', async () => {
        const res = await request(app)
            .post('/api/clientes')
            .set(auth())
            .send({ nombre: 'A' })
        expect(res.status).toBe(400)
    })

    it('rejects empty nombre with 400', async () => {
        const res = await request(app)
            .post('/api/clientes')
            .set(auth())
            .send({ nombre: '' })
        expect(res.status).toBe(400)
    })

    it('rejects nombre exceeding 100 chars with 400', async () => {
        const res = await request(app)
            .post('/api/clientes')
            .set(auth())
            .send({ nombre: 'A'.repeat(101) })
        expect(res.status).toBe(400)
    })

    it('accepts valid long nombre up to 100 chars', async () => {
        const res = await request(app)
            .post('/api/clientes')
            .set(auth())
            .send({ nombre: 'A'.repeat(100) })
        expect(res.status).toBe(201)
    })
})

describe('PUT /api/clientes/:id', () => {
    it('updates cliente fields', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Original', numero: 1 })
        const res = await request(app)
            .put(`/api/clientes/${cliente._id}`)
            .set(auth())
            .send({ nombre: 'Updated', contacto: '0800' })
        expect(res.status).toBe(200)
        expect(res.body.nombre).toBe('Updated')
    })

    it('returns 404 for non-existent id', async () => {
        const res = await request(app)
            .put('/api/clientes/507f1f77bcf86cd799439011')
            .set(auth())
            .send({ nombre: 'Nombre Válido' })
        expect(res.status).toBe(404)
    })

    it('rejects nombre shorter than 2 chars with 400', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Valid', numero: 5 })
        const res = await request(app)
            .put(`/api/clientes/${cliente._id}`)
            .set(auth())
            .send({ nombre: 'X' })
        expect(res.status).toBe(400)
    })

    it('rejects nombre exceeding 100 chars with 400', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Valid', numero: 6 })
        const res = await request(app)
            .put(`/api/clientes/${cliente._id}`)
            .set(auth())
            .send({ nombre: 'A'.repeat(101) })
        expect(res.status).toBe(400)
    })

    it('allows update without nombre field (partial update)', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Sin Cambio', numero: 7 })
        const res = await request(app)
            .put(`/api/clientes/${cliente._id}`)
            .set(auth())
            .send({ contacto: 'nuevo-telefono' })
        expect(res.status).toBe(200)
        expect(res.body.nombre).toBe('Sin Cambio')
    })
})

describe('DELETE /api/clientes/:id', () => {
    it('deletes cliente and returns success', async () => {
        const cliente = await models.Cliente.create({ nombre: 'ToDelete', numero: 99 })
        const res = await request(app).delete(`/api/clientes/${cliente._id}`).set(auth())
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
    })

    it('returns 404 for non-existent id', async () => {
        const res = await request(app)
            .delete('/api/clientes/507f1f77bcf86cd799439011')
            .set(auth())
        expect(res.status).toBe(404)
    })
})

describe('POST /api/clientes/:id/pago', () => {
    it('registers a payment and reduces cuentaCorriente', async () => {
        const cliente = await models.Cliente.create({ nombre: 'Deudor', numero: 3, cuentaCorriente: 1000 })
        const res = await request(app)
            .post(`/api/clientes/${cliente._id}/pago`)
            .set(auth())
            .send({ monto: 400, tipo: 'efectivo' })
        expect(res.status).toBe(200)
        const updated = await models.Cliente.findById(cliente._id)
        expect(updated.cuentaCorriente).toBeLessThan(1000)
    })

    it('returns 404 for non-existent cliente', async () => {
        const res = await request(app)
            .post('/api/clientes/507f1f77bcf86cd799439011/pago')
            .set(auth())
            .send({ monto: 100, tipo: 'efectivo' })
        expect(res.status).toBe(404)
    })
})
