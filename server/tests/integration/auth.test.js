import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import {
    createTestEnvironment,
    destroyTestEnvironment,
    clearCollections,
    registerAndLogin,
} from './helpers/testApp.js'

let app, conn, models, mongod

beforeAll(async () => {
    ;({ app, conn, models, mongod } = await createTestEnvironment())
})

afterAll(async () => {
    await destroyTestEnvironment({ conn, mongod })
})

beforeEach(async () => {
    await clearCollections(models)
})

// ─── Registration ─────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    const VALID = { email: 'user@test.com', password: 'Secure123', nombre: 'Test User' }

    it('creates user and returns token + 201', async () => {
        const res = await request(app).post('/api/auth/register').send(VALID)
        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('token')
        expect(res.body.user).toMatchObject({ email: 'user@test.com', nombre: 'Test User' })
        expect(res.body.user).not.toHaveProperty('password')
    })

    it('stores email in lowercase', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID, email: 'User@Test.COM' })
        expect(res.status).toBe(201)
        expect(res.body.user.email).toBe('user@test.com')
    })

    it('defaults role to "mesero" when not provided', async () => {
        const res = await request(app).post('/api/auth/register').send(VALID)
        expect(res.status).toBe(201)
        const user = await models.User.findOne({ email: 'user@test.com' })
        expect(user.role).toBe('mesero')
    })

    it('accepts explicit role "admin"', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID, role: 'admin' })
        expect(res.status).toBe(201)
        const user = await models.User.findOne({ email: 'user@test.com' })
        expect(user.role).toBe('admin')
    })

    it('rejects duplicate email with 400', async () => {
        await request(app).post('/api/auth/register').send(VALID)
        const res = await request(app).post('/api/auth/register').send(VALID)
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('El usuario ya existe')
    })

    it('rejects invalid email format with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID, email: 'not-an-email' })
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('errors')
    })

    it('rejects password shorter than 6 chars with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID, password: 'abc' })
        expect(res.status).toBe(400)
    })

    it('rejects missing nombre with 400', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ email: 'x@x.com', password: 'Secure123' })
        expect(res.status).toBe(400)
    })

    it('rejects empty body with 400', async () => {
        const res = await request(app).post('/api/auth/register').send({})
        expect(res.status).toBe(400)
    })
})

// ─── Login ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    const CREDS = { email: 'login@test.com', password: 'Secure123' }

    beforeEach(async () => {
        await request(app)
            .post('/api/auth/register')
            .send({ ...CREDS, nombre: 'Login User' })
    })

    it('returns 200 and token for valid credentials', async () => {
        const res = await request(app).post('/api/auth/login').send(CREDS)
        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('token')
        expect(res.body.message).toBe('Login exitoso')
    })

    it('is case-insensitive for email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ ...CREDS, email: 'LOGIN@TEST.COM' })
        expect(res.status).toBe(200)
    })

    it('returns 401 for wrong password', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ ...CREDS, password: 'WrongPass' })
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Credenciales inválidas')
    })

    it('returns 401 for non-existent user', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'ghost@test.com', password: 'Secure123' })
        expect(res.status).toBe(401)
    })

    it('returns 401 for inactive user', async () => {
        await models.User.updateOne({ email: 'login@test.com' }, { activo: false })
        const res = await request(app).post('/api/auth/login').send(CREDS)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Usuario inactivo')
    })

    it('rejects invalid email format with 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'bad-email', password: 'x' })
        expect(res.status).toBe(400)
    })

    it('rejects missing password with 400', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: CREDS.email })
        expect(res.status).toBe(400)
    })

    it('rejects empty body with 400', async () => {
        const res = await request(app).post('/api/auth/login').send({})
        expect(res.status).toBe(400)
    })
})

// ─── GET /me ──────────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
    it('returns user profile for valid token', async () => {
        const { token, payload } = await registerAndLogin(app, request)
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${token}`)
        expect(res.status).toBe(200)
        expect(res.body.user).toMatchObject({ email: payload.email })
        expect(res.body.user).not.toHaveProperty('password')
    })

    it('returns 401 without token', async () => {
        const res = await request(app).get('/api/auth/me')
        expect(res.status).toBe(401)
    })

    it('returns 401 for invalid token', async () => {
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', 'Bearer INVALID_TOKEN')
        expect(res.status).toBe(401)
    })

    it('returns 401 for expired token', async () => {
        const jwt = (await import('jsonwebtoken')).default
        const expired = jwt.sign({ userId: 'abc', tenant: 'test' }, process.env.JWT_SECRET, { expiresIn: '-1s' })
        const res = await request(app)
            .get('/api/auth/me')
            .set('Authorization', `Bearer ${expired}`)
        expect(res.status).toBe(401)
    })
})
