import mongoose from 'mongoose'

/**
 * Cache de conexiones por tenant.
 * Guardamos tanto la conexión (cuando está lista) como una promesa "in-flight"
 * para evitar abrir múltiples conexiones simultáneas al mismo tenant.
 */
const connectionCache = new Map()

const parseTenantMap = () => {
    const raw = process.env.TENANT_MONGODB_URIS
    if (!raw) return null
    try {
        const obj = JSON.parse(raw)
        if (obj && typeof obj === 'object') return obj
        return null
    } catch {
        return null
    }
}

export const getTenantMongoUri = (tenant) => {
    const t = String(tenant || '').trim().toLowerCase()

    const map = parseTenantMap()
    if (map && map[t]) return map[t]

    const template = process.env.MONGODB_URI_TEMPLATE
    if (template && template.includes('{tenant}')) {
        return template.replaceAll('{tenant}', t)
    }

    // Fallback (single-tenant)
    return process.env.MONGODB_URI || 'mongodb://localhost:27017/app-restos'
}

const toInt = (v, fallback) => {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
}

const attachConnLifecycleHandlers = (tenant, conn) => {
    // Nota: estos handlers se adjuntan 1 vez por conexión creada.
    conn.on('connected', () => {
        console.log(`✅ MongoDB conectado (tenant=${tenant})`)
    })

    conn.on('disconnected', () => {
        console.warn(`⚠️ MongoDB desconectado (tenant=${tenant}) - recreando conexión en próximo request`)
        const entry = connectionCache.get(tenant)
        // Evitar borrar si en el medio ya se reemplazó la conexión
        if (entry?.conn === conn) {
            connectionCache.delete(tenant)
        }
    })

    conn.on('error', (err) => {
        console.error(`❌ Error de MongoDB (tenant=${tenant})`, err)
        const entry = connectionCache.get(tenant)
        if (entry?.conn === conn) {
            connectionCache.delete(tenant)
        }
    })
}

const createTenantConnection = async (tenant) => {
    const uri = getTenantMongoUri(tenant)

    // Importante: desactivar buffering de comandos evita requests "colgadas" cuando Mongo se cae.
    // Preferimos fallar rápido y que el cliente vea el error, antes que aparentar "no guarda".
    const conn = mongoose.createConnection(uri, {
        serverSelectionTimeoutMS: toInt(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS, 10_000),
        socketTimeoutMS: toInt(process.env.MONGO_SOCKET_TIMEOUT_MS, 45_000),
        maxPoolSize: toInt(process.env.MONGO_MAX_POOL_SIZE, 10),
        minPoolSize: toInt(process.env.MONGO_MIN_POOL_SIZE, 0),
        heartbeatFrequencyMS: toInt(process.env.MONGO_HEARTBEAT_FREQUENCY_MS, 10_000),
        retryWrites: true,
        bufferCommands: false,
    })

    attachConnLifecycleHandlers(tenant, conn)
    await conn.asPromise()
    return conn
}

export const getTenantConnection = async (tenant) => {
    const t = String(tenant || '').trim().toLowerCase()
    if (!t) throw new Error('Tenant inválido')

    const existing = connectionCache.get(t)
    if (existing?.conn && existing.conn.readyState === 1) return existing.conn

    // Si hay una conexión en progreso, esperar a que termine.
    if (existing?.promise) {
        const conn = await existing.promise
        if (conn?.readyState === 1) return conn
        // Si no quedó conectada, recrear.
        connectionCache.delete(t)
    }

    const promise = createTenantConnection(t)
        .then((conn) => {
            const entry = connectionCache.get(t)
            if (entry) entry.conn = conn
            return conn
        })
        .catch((err) => {
            connectionCache.delete(t)
            throw err
        })

    connectionCache.set(t, { promise, conn: null })
    return await promise
}

