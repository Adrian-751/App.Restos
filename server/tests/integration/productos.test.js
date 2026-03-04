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
    await models.Producto.deleteMany({})
})

const auth = () => ({ Authorization: `Bearer ${token}` })

const VALID_PRODUCTO = { nombre: 'Pizza Margherita', precio: 1200, categoria: 'comida' }

describe('GET /api/productos', () => {
    it('returns empty array when no productos', async () => {
        const res = await request(app).get('/api/productos').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns all active productos', async () => {
        await models.Producto.create([
            { ...VALID_PRODUCTO, numero: 1 },
            { nombre: 'Coca Cola', precio: 400, numero: 2 },
        ])
        const res = await request(app).get('/api/productos').set(auth())
        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThanOrEqual(2)
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/productos')
        expect(res.status).toBe(401)
    })
})

describe('POST /api/productos', () => {
    it('creates a product (201)', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send(VALID_PRODUCTO)
        expect(res.status).toBe(201)
        expect(res.body.nombre).toBe('Pizza Margherita')
        expect(res.body.precio).toBe(1200)
    })

    it('rejects missing nombre with 400', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ precio: 100 })
        expect(res.status).toBe(400)
    })

    it('rejects nombre shorter than 2 chars with 400', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'X', precio: 100 })
        expect(res.status).toBe(400)
    })

    it('rejects nombre longer than 100 chars with 400', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'A'.repeat(101), precio: 100 })
        expect(res.status).toBe(400)
    })

    it('rejects negative precio with 400', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'Negativo', precio: -10 })
        expect(res.status).toBe(400)
    })

    it('rejects missing precio with 400', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'Sin precio' })
        expect(res.status).toBe(400)
    })

    it('accepts precio = 0', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'Gratis', precio: 0 })
        expect(res.status).toBe(201)
    })

    it('rejects non-integer stock', async () => {
        const res = await request(app)
            .post('/api/productos')
            .set(auth())
            .send({ nombre: 'StockFloat', precio: 100, stock: 1.5 })
        expect(res.status).toBe(400)
    })

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/productos').send(VALID_PRODUCTO)
        expect(res.status).toBe(401)
    })
})

describe('PUT /api/productos/:id', () => {
    it('updates product fields', async () => {
        const prod = await models.Producto.create({ nombre: 'Old', precio: 100, numero: 1 })
        const res = await request(app)
            .put(`/api/productos/${prod._id}`)
            .set(auth())
            .send({ nombre: 'New Name', precio: 200 })
        expect(res.status).toBe(200)
        expect(res.body.nombre).toBe('New Name')
        expect(res.body.precio).toBe(200)
    })

    it('returns 404 for non-existent id', async () => {
        const res = await request(app)
            .put('/api/productos/507f1f77bcf86cd799439011')
            .set(auth())
            .send({ nombre: 'Valid Name', precio: 100 })
        expect(res.status).toBe(404)
    })

    it('rejects invalid nombre on update', async () => {
        const prod = await models.Producto.create({ nombre: 'Valid', precio: 100, numero: 2 })
        const res = await request(app)
            .put(`/api/productos/${prod._id}`)
            .set(auth())
            .send({ nombre: 'X' }) // too short
        expect(res.status).toBe(400)
    })
})

describe('DELETE /api/productos/:id', () => {
    it('deletes product and returns success', async () => {
        const prod = await models.Producto.create({ nombre: 'ToDelete', precio: 100, numero: 3 })
        const res = await request(app).delete(`/api/productos/${prod._id}`).set(auth())
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(await models.Producto.findById(prod._id)).toBeNull()
    })

    it('returns 404 for non-existent product', async () => {
        const res = await request(app)
            .delete('/api/productos/507f1f77bcf86cd799439011')
            .set(auth())
        expect(res.status).toBe(404)
    })

    it('returns 401 without token', async () => {
        const prod = await models.Producto.create({ nombre: 'AuthTest', precio: 100, numero: 4 })
        const res = await request(app).delete(`/api/productos/${prod._id}`)
        expect(res.status).toBe(401)
    })
})
