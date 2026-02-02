import mongoose from 'mongoose'

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

export const getTenantConnection = async (tenant) => {
    const t = String(tenant || '').trim().toLowerCase()
    if (!t) throw new Error('Tenant inválido')

    if (connectionCache.has(t)) return await connectionCache.get(t)

    const uri = getTenantMongoUri(t)
    const promise = (async () => {
        const conn = mongoose.createConnection(uri, {})
        await conn.asPromise()
        return conn
    })()

    connectionCache.set(t, promise)
    return await promise
}

