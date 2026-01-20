# 📚 Ejemplos de Implementación Paso a Paso

Esta guía te muestra cómo implementar cada mejora SIN cambiar la UI existente.

---

## 🔧 PASO 1: Configuración Inicial

### 1.1 Instalar dependencias

```bash
cd server
npm install jsonwebtoken bcryptjs uuid mongoose express-validator express-rate-limit
npm install --save-dev @types/jsonwebtoken @types/bcryptjs @types/uuid
```

### 1.2 Crear archivo `.env`

En `server/.env`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/app-restos
JWT_SECRET=mi_secreto_super_seguro_123456789
JWT_EXPIRES_IN=24h
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 1.3 Crear estructura de carpetas

```bash
cd server
mkdir -p config models controllers middleware routes utils
```

---

## 🔐 PASO 2: Autenticación (Sin cambiar UI)

### 2.1 Crear modelo User

**Archivo:** `server/models/User.js`

```javascript
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    role: {
        type: String,
        enum: ['admin', 'mozo', 'cajero'],
        default: 'mozo'
    },
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Encriptar contraseña antes de guardar
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
```

### 2.2 Crear controlador de autenticación

**Archivo:** `server/controllers/authController.js`

```javascript
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

const generateToken = (userId) => {
    return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

export const register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        const userExists = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (userExists) {
            return res.status(400).json({ 
                error: 'El usuario o email ya existe' 
            });
        }

        const user = await User.create({
            username,
            email,
            password,
            role: role || 'mozo'
        });

        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al registrar usuario',
            message: error.message 
        });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        if (!user.activo) {
            return res.status(401).json({ 
                error: 'Usuario desactivado' 
            });
        }

        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        const token = generateToken(user._id);

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al iniciar sesión',
            message: error.message 
        });
    }
};

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al obtener usuario',
            message: error.message 
        });
    }
};
```

### 2.3 Crear middleware de autenticación

**Archivo:** `server/middleware/auth.js`

```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'No se proporcionó token de autenticación' 
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await User.findById(decoded.userId);
        if (!user || !user.activo) {
            return res.status(401).json({ 
                error: 'Usuario no válido o desactivado' 
            });
        }

        req.userId = user._id;
        req.userRole = user.role;
        req.user = user;

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                error: 'Token inválido' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expirado' 
            });
        }
        res.status(500).json({ 
            error: 'Error al verificar autenticación',
            message: error.message 
        });
    }
};

export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({ 
                error: 'No autenticado' 
            });
        }

        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ 
                error: 'No tienes permisos para esta acción' 
            });
        }

        next();
    };
};
```

### 2.4 Crear rutas de autenticación

**Archivo:** `server/routes/auth.js`

```javascript
import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);

export default router;
```

### 2.5 Actualizar frontend para usar autenticación

**Archivo:** `client/src/utils/api.js` (NUEVO)

```javascript
import axios from 'axios';

// Crear instancia de axios con configuración base
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
});

// Interceptor: agregar token a cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor: manejar errores de autenticación
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            // Opcional: redirigir a login
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
```

**Ahora reemplaza `axios` por `api` en tus componentes:**

En `client/src/pages/Mesas.jsx`:

```javascript
// ANTES:
import axios from 'axios'
const res = await axios.get('/api/mesas')

// DESPUÉS:
import api from '../utils/api'
const res = await api.get('/mesas')
```

---

## 🗄️ PASO 3: Migrar a MongoDB

### 3.1 Configurar conexión

**Archivo:** `server/config/database.js`

```javascript
import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        process.exit(1);
    }
};

export default connectDB;
```

### 3.2 Crear modelos (ejemplo: Mesa)

**Archivo:** `server/models/Mesa.js`

```javascript
import mongoose from 'mongoose';

const mesaSchema = new mongoose.Schema({
    numero: {
        type: String,
        required: true
    },
    nombre: {
        type: String,
        default: ''
    },
    x: {
        type: Number,
        default: 0
    },
    y: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        default: '#e11d48'
    },
    estado: {
        type: String,
        enum: ['libre', 'ocupada', 'reservada'],
        default: 'libre'
    }
}, {
    timestamps: true
});

export default mongoose.model('Mesa', mesaSchema);
```

### 3.3 Actualizar controlador de mesas

**Archivo:** `server/controllers/mesaController.js`

```javascript
import Mesa from '../models/Mesa.js';

export const getMesas = async (req, res) => {
    try {
        const mesas = await Mesa.find().sort({ createdAt: -1 });
        res.json(mesas);
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al obtener mesas',
            message: error.message 
        });
    }
};

export const createMesa = async (req, res) => {
    try {
        const mesa = await Mesa.create(req.body);
        res.status(201).json(mesa);
    } catch (error) {
        res.status(400).json({ 
            error: 'Error al crear mesa',
            message: error.message 
        });
    }
};

export const updateMesa = async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!mesa) {
            return res.status(404).json({ error: 'Mesa no encontrada' });
        }

        res.json(mesa);
    } catch (error) {
        res.status(400).json({ 
            error: 'Error al actualizar mesa',
            message: error.message 
        });
    }
};

export const deleteMesa = async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndDelete(req.params.id);

        if (!mesa) {
            return res.status(404).json({ error: 'Mesa no encontrada' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al eliminar mesa',
            message: error.message 
        });
    }
};
```

### 3.4 Crear rutas de mesas

**Archivo:** `server/routes/mesas.js`

```javascript
import express from 'express';
import { getMesas, createMesa, updateMesa, deleteMesa } from '../controllers/mesaController.js';
import { authenticate } from '../middleware/auth.js';
import { validateMesa } from '../middleware/validate.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/', getMesas);
router.post('/', validateMesa, createMesa);
router.put('/:id', validateMesa, updateMesa);
router.delete('/:id', deleteMesa);

export default router;
```

### 3.5 Actualizar index.js principal

**Archivo:** `server/index.js`

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

const app = express();

// CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Importar rutas
import authRoutes from './routes/auth.js';
import mesaRoutes from './routes/mesas.js';
// ... importar otras rutas

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/mesas', mesaRoutes);
// ... usar otras rutas

// Manejo de errores (debe ir al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
```

---

## ✅ PASO 4: Validación de Inputs

### 4.1 Crear validadores

**Archivo:** `server/middleware/validate.js`

```javascript
import { body, validationResult } from 'express-validator';

export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            error: 'Datos inválidos',
            errors: errors.array() 
        });
    }
    next();
};

export const validateMesa = [
    body('numero')
        .trim()
        .notEmpty()
        .withMessage('El número de mesa es requerido'),
    body('nombre')
        .optional()
        .trim(),
    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('El color debe ser un código hexadecimal válido'),
    handleValidationErrors
];
```

### 4.2 Usar en rutas

```javascript
import { validateMesa } from '../middleware/validate.js';

router.post('/mesas', authenticate, validateMesa, createMesa);
```

---

## 🛡️ PASO 5: Manejo de Errores

### 5.1 Crear error handler

**Archivo:** `server/middleware/errorHandler.js`

```javascript
export const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    console.error(err);

    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
    }

    if (err.code === 11000) {
        error = { message: 'Dato duplicado', statusCode: 400 };
    }

    if (err.name === 'CastError') {
        error = { message: 'Recurso no encontrado', statusCode: 404 };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error del servidor'
    });
};

export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
```

---

## ⏳ PASO 6: Estados de Carga (Frontend)

### 6.1 Crear hook useAsync

**Archivo:** `client/src/hooks/useAsync.js`

```javascript
import { useState, useEffect } from 'react';

export const useAsync = (asyncFunction, dependencies = []) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        
        asyncFunction()
            .then(setData)
            .catch(setError)
            .finally(() => setLoading(false));
    }, dependencies);

    return { data, loading, error };
};
```

### 6.2 Usar en componente (ejemplo Mesas.jsx)

```javascript
import { useAsync } from '../hooks/useAsync';
import api from '../utils/api';

const Mesas = () => {
    const { data: mesas, loading, error } = useAsync(
        () => api.get('/mesas').then(res => res.data),
        []
    );

    // Estados de carga - SIN CAMBIAR LA UI EXISTENTE
    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-white mb-6">Mapa de Mesas</h2>
                <div className="card flex justify-center items-center min-h-[600px]">
                    <div className="text-white text-xl">Cargando mesas...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <h2 className="text-3xl font-bold text-white mb-6">Mapa de Mesas</h2>
                <div className="card bg-red-900">
                    <div className="text-red-200">Error: {error.message}</div>
                </div>
            </div>
        );
    }

    // Tu código existente aquí, solo cambia:
    // const [mesas, setMesas] = useState([])
    // por usar: const { data: mesas } = useAsync(...)
    
    // Y elimina el useEffect que hace fetchMesas()
    
    return (
        // Tu JSX existente, sin cambios
    );
};
```

---

## 🔄 PASO 7: Script de Migración de Datos

### 7.1 Usar el script de migración

Una vez que hayas creado todos los modelos, puedes migrar los datos existentes de JSON a MongoDB.

**El script ya está creado en:** `server/scripts/migrateToMongo.js`

### 7.2 Ejecutar la migración

```bash
# Asegúrate de que MongoDB esté corriendo
# Luego ejecuta:
cd server
node scripts/migrateToMongo.js
```

**El script:**
- ✅ Conecta a MongoDB
- ✅ Limpia las colecciones existentes (opcional)
- ✅ Lee los archivos JSON de `server/data/`
- ✅ Convierte los datos al formato de MongoDB
- ✅ Mapea referencias entre colecciones (ej: mesaId en pedidos)
- ✅ Inserta todos los datos
- ✅ Muestra un resumen de la migración

### 7.3 Antes de ejecutar

**Asegúrate de tener:**
1. ✅ MongoDB corriendo (`mongosh` para verificar)
2. ✅ Todos los modelos creados (Mesa, Producto, Cliente, Pedido, Caja)
3. ✅ Archivo `.env` configurado con `MONGODB_URI`
4. ✅ Los archivos JSON en `server/data/`

### 7.4 Después de migrar

Verifica los datos:
```bash
# Conectar a MongoDB
mongosh mongodb://localhost:27017/app-restos

# Ver colecciones
show collections

# Ver datos migrados
db.mesas.find().pretty()
db.productos.find().pretty()
db.clientes.find().pretty()
db.pedidos.find().pretty()
db.cajas.find().pretty()
```

**⚠️ IMPORTANTE:** 
- El script **limpia** las colecciones antes de migrar
- Si quieres mantener datos existentes, edita el script y comenta las líneas `deleteMany()`
- Haz un backup antes de ejecutar si tienes datos importantes

---

## 🚦 PASO 8: Rate Limiting (Protección contra Abuso)

### 8.1 ¿Por qué?
Rate limiting protege tu API contra:
- Ataques de fuerza bruta
- Abuso de endpoints
- Sobrecarga del servidor

### 8.2 Configurar rate limiting

**Archivo:** `server/index.js`

Agrega después de `express.json()` y antes de las rutas:

```javascript
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
app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
```

### 8.3 Código completo de index.js (actualizado)

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from 'express-rate-limit';
import connectDB from "./config/database.js";
import { errorHandler } from "./middleware/errorHandler.js";

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

const app = express();

// CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
};
app.use(cors(corsOptions));
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100,
    message: { error: 'Demasiadas peticiones, intenta más tarde' }
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Demasiados intentos, intenta más tarde' },
    skipSuccessfulRequests: true
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Importar rutas
import authRoutes from './routes/auth.js';
import mesaRoutes from './routes/mesas.js';
// ... importar otras rutas

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/mesas', mesaRoutes);
// ... usar otras rutas

// Manejo de errores (debe ir al final)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
```

---

## 📝 Orden de Implementación Recomendado

1. **Semana 1:**
   - Día 1-2: Configuración inicial + Autenticación básica
   - Día 3-4: Migrar un módulo a MongoDB (empezar con Mesas)
   - Día 5: Validaciones básicas

2. **Semana 2:**
   - Día 1-2: Migrar todos los módulos a MongoDB + Ejecutar script de migración
   - Día 3: Manejo de errores
   - Día 4: Estados de carga en frontend
   - Día 5: Rate limiting + Testing y ajustes

---

## 🧪 Cómo Probar Cada Paso

### Probar Autenticación:
```bash
# 1. Registrar usuario
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"123456"}'

# 2. Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# 3. Usar token en petición
curl -X GET http://localhost:3000/api/mesas \
  -H "Authorization: Bearer TU_TOKEN_AQUI"
```

### Probar MongoDB:
```bash
# Conectar a MongoDB
mongosh mongodb://localhost:27017/app-restos

# Ver colecciones
show collections

# Ver datos
db.mesas.find()
```

### Probar Script de Migración:
```bash
# Ejecutar migración
cd server
node scripts/migrateToMongo.js

# Verificar datos migrados
mongosh mongodb://localhost:27017/app-restos
db.mesas.countDocuments()
db.productos.countDocuments()
```

---

## ⚠️ Errores Comunes y Soluciones

### Error: "Cannot find module"
```bash
# Asegúrate de estar en la carpeta correcta
cd server
npm install
```

### Error: "MongoDB connection failed"
```bash
# Verifica que MongoDB esté corriendo
mongosh

# O instala MongoDB si no lo tienes
# macOS: brew install mongodb-community
```

### Error: "JWT malformed"
- Verifica que el token se esté enviando correctamente
- Revisa que JWT_SECRET esté en .env

### Error: "Demasiadas peticiones" (Rate Limiting)
- Es normal después de muchos requests
- Espera 15 minutos o ajusta el límite en `index.js`

### Error en migración: "Cannot find module"
- Asegúrate de que todos los modelos estén creados
- Verifica que estés en la carpeta `server` al ejecutar
- Revisa que los archivos JSON existan en `server/data/`

---

¡Sigue estos pasos uno por uno y estarás listo! 🚀

