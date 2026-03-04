import { getTenantConnection } from './connectionManager.js'
import { getModels } from './models.js'
import { logger } from '../utils/logger.js'

export const attachTenantDb = async (req, res, next) => {
    try {
        const tenant = req.tenant || 'default'
        const conn = await getTenantConnection(tenant)
        req.db = conn
        req.models = getModels(conn)
        next()
    } catch (err) {
        logger.error({ err, tenant: req.tenant }, 'attachTenantDb: error al conectar DB')
        return res.status(500).json({
            error: 'No se pudo conectar a la base de datos del cliente',
            message: process.env.NODE_ENV === 'development' ? err?.message : undefined,
        })
    }
}

