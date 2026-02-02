import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler.js';
import { tenantMiddleware } from './tenancy/tenant.js';
import { attachTenantDb } from './tenancy/attachTenantDb.js';

// Importar rutas
import authRoutes from './routes/auth.js';
import cajaRoutes from './routes/caja.js';
import mesasRoutes from './routes/mesas.js';
import pedidosRoutes from './routes/pedidos.js';
import clientesRoutes from './routes/clientes.js';
import productosRoutes from './routes/productos.js';
import turnosRoutes from './routes/turnos.js';
import metricasRoutes from './routes/metricas.js';
import historicoRoutes from './routes/historico.js';

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middlewares globales
// CORS
// - En producción: permitir solo el FRONTEND_URL configurado
// - En desarrollo: permitir localhost
// Nota: no usamos cookies, así que no necesitamos `credentials: true`
const isProduction = process.env.NODE_ENV === 'production'
const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

const allowedOrigins = [
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
    cors({
        origin: (origin, callback) => {
            // En desarrollo permitimos cualquier origin para que puedas probar desde la red local
            // (ej: http://192.168.x.x:5173 en el celular).
            if (!isProduction) return callback(null, true)

            // Permitir requests sin Origin (ej: curl/health checks)
            if (!origin) return callback(null, true);

            // Si no se configuró FRONTEND_URL todavía, no bloqueamos (útil para bootstrap)
            if (allowedOrigins.length === 0) return callback(null, true);

            if (allowedOrigins.includes(origin)) return callback(null, true);

            return callback(new Error(`CORS bloqueado para origin: ${origin}`));
        },
    })
);
app.use(express.json());

import rateLimit from 'express-rate-limit';

// Rate limiting general para toda la API
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP en la ventana
    message: {
        error: 'Demasiadas peticiones desde esta IP, intenta más tarde'
    },
    standardHeaders: true, // Retorna info de rate limit en headers
    legacyHeaders: false
});

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login/register
    message: {
        error: 'Demasiados intentos, intenta más tarde'
    },
    skipSuccessfulRequests: true // No contar requests exitosos
});

// Aplicar rate limiting
// - Por defecto en desarrollo: DESACTIVADO (para no romper la UI con muchas requests)
// - Activar con RATE_LIMIT_ENABLED=true o en producción
const rateLimitEnabled =
    process.env.RATE_LIMIT_ENABLED === 'true' || process.env.NODE_ENV === 'production';
if (rateLimitEnabled) {
    app.use('/api/', limiter);
    app.use('/api/auth/login', authLimiter);
    app.use('/api/auth/register', authLimiter);
}

// Ruta de salud/health check
app.get('/api/health', (req, res) => {
    res.json({
        message: 'Servidor funcionando correctamente',
        timestamp: new Date().toISOString()
    });
});

// Multi-tenant: resolver tenant + conectar DB del cliente para todas las rutas /api/*
app.use('/api', tenantMiddleware, attachTenantDb);

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/pedidos', pedidosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/turnos', turnosRoutes);
app.use('/api/metricas', metricasRoutes);
app.use('/api/historico', historicoRoutes);

// Middleware de manejo de errores (debe ir al final, después de todas las rutas)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        app.listen(PORT, () => {
            console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
            console.log(`📊 Modo: ${process.env.NODE_ENV || 'development'}`);
        });
    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error);
        process.exit(1);
    }
};

startServer();