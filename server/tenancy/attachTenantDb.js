import { getTenantConnection } from './connectionManager.js'
import { getModels } from './models.js'

export const attachTenantDb = async (req, res, next) => {
    try {
        const tenant = req.tenant || 'default'
        const conn = await getTenantConnection(tenant)
        req.db = conn
        req.models = getModels(conn)
        next()
    } catch (err) {
        return res.status(500).json({ error: 'No se pudo conectar a la base de datos del cliente' })
    }
}

