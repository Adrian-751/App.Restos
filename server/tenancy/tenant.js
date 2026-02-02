/**
 * Multi-tenant helpers (1 DB por cliente)
 *
 * Resolución de tenant (prioridad):
 * 1) Header: X-Tenant
 * 2) Subdominio del Host (ej: cliente1.tudominio.com -> cliente1)
 * 3) Fallback dev: DEFAULT_TENANT o "default"
 */

const normalizeTenant = (value) => {
    if (!value) return null
    const t = String(value).trim().toLowerCase()
    // Permitir solo [a-z0-9-] para evitar problemas
    const clean = t.replace(/[^a-z0-9-]/g, '')
    return clean || null
}

const isLocalHost = (host) => {
    return (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host === '0.0.0.0' ||
        // IPv4 LAN (dev)
        /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    )
}

export const resolveTenant = (req) => {
    const headerTenant = normalizeTenant(req.headers['x-tenant'])
    if (headerTenant) return headerTenant

    const hostHeader = req.headers.host || ''
    const host = hostHeader.split(':')[0].toLowerCase()
    if (!host) return normalizeTenant(process.env.DEFAULT_TENANT) || 'default'

    if (isLocalHost(host)) {
        // Para dev/local, dejamos que se elija por query (?tenant=xxx) si querés
        const queryTenant = normalizeTenant(req.query?.tenant)
        return queryTenant || normalizeTenant(process.env.DEFAULT_TENANT) || 'default'
    }

    const parts = host.split('.').filter(Boolean)
    if (parts.length < 3) {
        // No hay subdominio (ej: tudominio.com). Usar DEFAULT_TENANT.
        return normalizeTenant(process.env.DEFAULT_TENANT) || 'default'
    }

    // Tenant = primer label (cliente1.tudominio.com -> cliente1)
    return normalizeTenant(parts[0]) || normalizeTenant(process.env.DEFAULT_TENANT) || 'default'
}

export const tenantMiddleware = (req, _res, next) => {
    req.tenant = resolveTenant(req)
    next()
}

