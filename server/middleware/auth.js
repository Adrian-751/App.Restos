import jwt from 'jsonwebtoken';

/**
 * Middleware para verificar el token JWT.
 * - Valida el Bearer token
 * - Carga el usuario desde MongoDB
 * - Setea: req.userId, req.userRole, req.user
*/
export const authenticate = async (req, res, next) => {
    try {
        // Permite desactivar auth temporalmente en desarrollo:
        // AUTH_ENABLED=false
        if (process.env.AUTH_ENABLED === 'false') {
            req.userId = null;
            req.userRole = null;
            req.user = null;
            return next();
        }

        const authHeader = req.headers.authorization;

        /**
         * Por defecto, NO bloqueamos la app si no hay login/UI.
         * - Si AUTH_REQUIRED=false => el token es opcional: si no hay header, se deja pasar.
         * - En cualquier otro caso (incluyendo no configurado) => el token es obligatorio.
         */
        const authRequired = process.env.AUTH_REQUIRED !== 'false';
        const hasBearer = !!authHeader && authHeader.startsWith('Bearer ');
        if (!hasBearer) {
            if (authRequired) {
                return res.status(401).json({ error: 'No se proporcionó token de autenticación' });
            }
            req.userId = null;
            req.userRole = null;
            req.user = null;
            return next();
        }

        const token = authHeader.substring(7);

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ error: 'JWT_SECRET no está configurado en el servidor' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Validación multi-tenant: el token debe pertenecer al tenant actual
        if (decoded?.tenant && req.tenant && decoded.tenant !== req.tenant) {
            return res.status(401).json({ error: 'Token no corresponde a este cliente' });
        }

        const { User } = req.models || {}
        if (!User) {
            return res.status(500).json({ error: 'Modelos no inicializados para este cliente' });
        }
        const user = await User.findById(decoded.userId);

        if (!user || !user.activo) {
            return res.status(401).json({ error: 'Usuario no válido o desactivado' });
        }

        req.userId = user._id;
        req.userRole = user.role;
        req.user = user;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Token inválido' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expirado' });
        }
        return res.status(500).json({ error: 'Error al verificar autenticación' });
    }
};

/**
 * Middleware de autorización por roles.
 * Uso: router.post('/x', authenticate, authorize('admin'), handler)
*/
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({ error: 'No autenticado' });
        }
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ error: 'No tienes permisos para esta acción' });
        }
        next();
    };
};

// Backwards-compat: alias común
export const isAdmin = authorize('admin');