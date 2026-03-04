/**
 * Test app helper: creates a fully-wired Express app backed by an in-memory
 * MongoDB instance. Replaces the real tenantMiddleware + attachTenantDb with
 * a lightweight injector so tests are fully self-contained.
 */
import express from 'express'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { getModels } from '../../../tenancy/models.js'
import { errorHandler } from '../../../middleware/errorHandler.js'
import authRoutes from '../../../routes/auth.js'
import pedidosRoutes from '../../../routes/pedidos.js'
import mesasRoutes from '../../../routes/mesas.js'
import cajaRoutes from '../../../routes/caja.js'
import clientesRoutes from '../../../routes/clientes.js'
import productosRoutes from '../../../routes/productos.js'
import turnosRoutes from '../../../routes/turnos.js'
import metricasRoutes from '../../../routes/metricas.js'
import historicoRoutes from '../../../routes/historico.js'

export const createTestEnvironment = async () => {
    process.env.JWT_SECRET = 'qa_test_secret_2026'
    process.env.JWT_EXPIRES_IN = '1h'
    process.env.NODE_ENV = 'test'
    process.env.AUTH_REQUIRED = 'true'
    process.env.AUTH_ENABLED = 'true'

    const mongod = await MongoMemoryServer.create()
    const conn = await mongoose.createConnection(mongod.getUri())
    const models = getModels(conn)

    const app = express()
    app.use(express.json({ limit: '10mb' }))

    // Inject test tenant + models — replaces tenantMiddleware + attachTenantDb
    app.use((req, _res, next) => {
        req.tenant = 'test'
        req.db = conn
        req.models = models
        next()
    })

    app.use('/api/auth', authRoutes)
    app.use('/api/pedidos', pedidosRoutes)
    app.use('/api/mesas', mesasRoutes)
    app.use('/api/caja', cajaRoutes)
    app.use('/api/clientes', clientesRoutes)
    app.use('/api/productos', productosRoutes)
    app.use('/api/turnos', turnosRoutes)
    app.use('/api/metricas', metricasRoutes)
    app.use('/api/historico', historicoRoutes)
    app.use(errorHandler)

    return { app, conn, models, mongod }
}

export const destroyTestEnvironment = async ({ conn, mongod }) => {
    await conn.close()
    await mongod.stop()
}

export const clearCollections = async (models) => {
    await Promise.all([
        models.User.deleteMany({}),
        models.Pedido.deleteMany({}),
        models.Mesa.deleteMany({}),
        models.Caja.deleteMany({}),
        models.Cliente.deleteMany({}),
        models.Producto.deleteMany({}),
        models.Turno.deleteMany({}),
        models.AppState.deleteMany({}),
    ])
}

/**
 * Registers a user and returns { token, user }
 */
export const registerAndLogin = async (app, request, overrides = {}) => {
    const payload = {
        email: `qa_${Date.now()}@test.com`,
        password: 'Password123',
        nombre: 'QA User',
        role: 'admin',
        ...overrides,
    }
    const res = await request(app).post('/api/auth/register').send(payload)
    return { token: res.body.token, user: res.body.user, payload }
}
