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
    await models.Mesa.deleteMany({})
})

const auth = () => ({ Authorization: `Bearer ${token}` })

describe('GET /api/mesas', () => {
    it('returns empty array when no mesas', async () => {
        const res = await request(app).get('/api/mesas').set(auth())
        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    it('returns mesas sorted by numero asc', async () => {
        await models.Mesa.create([
            { numero: 3, estado: 'libre' },
            { numero: 1, estado: 'libre' },
            { numero: 2, estado: 'libre' },
        ])
        const res = await request(app).get('/api/mesas').set(auth())
        expect(res.status).toBe(200)
        const numeros = res.body.map(m => m.numero)
        expect(numeros).toEqual([1, 2, 3])
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/mesas')
        expect(res.status).toBe(401)
    })
})

describe('POST /api/mesas', () => {
    it('creates mesa with defaults (201)', async () => {
        const res = await request(app)
            .post('/api/mesas')
            .set(auth())
            .send({ numero: 1 })
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({ numero: 1, estado: 'libre' })
        expect(res.body.color).toBeTruthy()
    })

    it('accepts optional nombre, x, y, color', async () => {
        const res = await request(app)
            .post('/api/mesas')
            .set(auth())
            .send({ numero: 5, nombre: 'VIP', x: 100, y: 200, color: '#FF5733' })
        expect(res.status).toBe(201)
        expect(res.body.nombre).toBe('VIP')
        expect(res.body.x).toBe(100)
    })

    it('rejects missing numero with 400', async () => {
        const res = await request(app).post('/api/mesas').set(auth()).send({ nombre: 'NoNum' })
        expect(res.status).toBe(400)
    })

    it('rejects invalid hex color with 400', async () => {
        const res = await request(app)
            .post('/api/mesas')
            .set(auth())
            .send({ numero: 9, color: 'not-a-hex' })
        expect(res.status).toBe(400)
    })

    it('stores nombresPorFecha when fecha + nombre are provided', async () => {
        const res = await request(app)
            .post('/api/mesas')
            .set(auth())
            .send({ numero: 10, nombre: 'Turno1', fecha: '2026-03-04' })
        expect(res.status).toBe(201)
        expect(res.body.nombresPorFecha).toMatchObject({ '2026-03-04': 'Turno1' })
    })

    it('returns 401 without token', async () => {
        const res = await request(app).post('/api/mesas').send({ numero: 99 })
        expect(res.status).toBe(401)
    })
})

describe('PUT /api/mesas/:id', () => {
    it('updates mesa fields', async () => {
        const mesa = await models.Mesa.create({ numero: 1, estado: 'libre' })
        const res = await request(app)
            .put(`/api/mesas/${mesa._id}`)
            .set(auth())
            .send({ estado: 'ocupada' })
        expect(res.status).toBe(200)
        expect(res.body.estado).toBe('ocupada')
    })

    it('saves nombresPorFecha entry when fecha is provided', async () => {
        const mesa = await models.Mesa.create({ numero: 2, estado: 'libre' })
        const res = await request(app)
            .put(`/api/mesas/${mesa._id}`)
            .set(auth())
            .send({ nombre: 'Lunes Pepe', fecha: '2026-03-04' })
        expect(res.status).toBe(200)
        expect(res.body.nombresPorFecha).toMatchObject({ '2026-03-04': 'Lunes Pepe' })
    })

    it('removes fecha entry when nombre is empty', async () => {
        const mesa = await models.Mesa.create({
            numero: 3, estado: 'libre',
            nombresPorFecha: { '2026-03-04': 'Old' },
        })
        const res = await request(app)
            .put(`/api/mesas/${mesa._id}`)
            .set(auth())
            .send({ nombre: '', fecha: '2026-03-04' })
        expect(res.status).toBe(200)
        expect(res.body.nombresPorFecha?.['2026-03-04']).toBeUndefined()
    })

    it('returns 404 for non-existent mesa', async () => {
        const res = await request(app)
            .put('/api/mesas/507f1f77bcf86cd799439011')
            .set(auth())
            .send({ estado: 'libre' })
        expect(res.status).toBe(404)
    })

    it('rejects invalid color on update', async () => {
        const mesa = await models.Mesa.create({ numero: 4, estado: 'libre' })
        const res = await request(app)
            .put(`/api/mesas/${mesa._id}`)
            .set(auth())
            .send({ color: 'red' })
        expect(res.status).toBe(400)
    })
})

describe('DELETE /api/mesas/:id', () => {
    it('deletes mesa and returns { success: true }', async () => {
        const mesa = await models.Mesa.create({ numero: 99, estado: 'libre' })
        const res = await request(app).delete(`/api/mesas/${mesa._id}`).set(auth())
        expect(res.status).toBe(200)
        expect(res.body.success).toBe(true)
        expect(await models.Mesa.findById(mesa._id)).toBeNull()
    })

    it('returns 404 for non-existent mesa', async () => {
        const res = await request(app)
            .delete('/api/mesas/507f1f77bcf86cd799439011')
            .set(auth())
        expect(res.status).toBe(404)
    })

    it('returns 401 without token', async () => {
        const mesa = await models.Mesa.create({ numero: 55, estado: 'libre' })
        const res = await request(app).delete(`/api/mesas/${mesa._id}`)
        expect(res.status).toBe(401)
    })
})
