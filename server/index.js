import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';

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
const corsOptions = {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
};
app.use(cors(corsOptions));
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

// Conectar a la base de datos y iniciar servidor
const PORT = process.env.PORT || 3000;

const startServer = async () => {
    try {
        await connectDB();
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