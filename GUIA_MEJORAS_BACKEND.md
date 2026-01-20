# 🚀 Guía Completa: Mejoras de Backend para App.Restos

## 📋 Índice
1. [Preparación del Entorno](#1-preparación-del-entorno)
2. [Sistema de Autenticación y Autorización](#2-sistema-de-autenticación-y-autorización)
3. [Migración a Base de Datos Real](#3-migración-a-base-de-datos-real)
4. [Validación de Inputs](#4-validación-de-inputs)
5. [Mejora del Manejo de Errores](#5-mejora-del-manejo-de-errores)
6. [Sistema de IDs Únicos (UUID)](#6-sistema-de-ids-únicos-uuid)
7. [Estados de Carga](#7-estados-de-carga)
8. [Refactorización de Código Repetitivo](#8-refactorización-de-código-repetitivo)
9. [Otras Mejoras Importantes](#9-otras-mejoras-importantes)

---

## 1. Preparación del Entorno

### ¿Por qué?
Necesitamos organizar las variables de configuración y dependencias antes de empezar.

### Paso 1.1: Instalar dependencias necesarias

```bash
cd server
npm install jsonwebtoken bcryptjs uuid mongoose dotenv express-validator
npm install --save-dev @types/jsonwebtoken @types/bcryptjs @types/uuid
```

**Explicación:**
- `jsonwebtoken`: Para crear tokens de autenticación
- `bcryptjs`: Para encriptar contraseñas
- `uuid`: Para generar IDs únicos
- `mongoose`: Para trabajar con MongoDB
- `dotenv`: Para variables de entorno (ya lo tienes)
- `express-validator`: Para validar datos

### Paso 1.2: Crear archivo `.env`

Crea un archivo `.env` en la carpeta `server/`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/app-restos
JWT_SECRET=tu_secreto_super_seguro_aqui_cambialo_en_produccion
JWT_EXPIRES_IN=24h
NODE_ENV=development
```

**⚠️ IMPORTANTE:** 
- NUNCA subas el archivo `.env` a Git
- En producción, usa secretos más seguros
- Agrega `.env` a tu `.gitignore`

### Paso 1.3: Crear estructura de carpetas

```
server/
├── config/
│   └── database.js        # Configuración de MongoDB
├── models/                # Modelos de datos
│   ├── User.js
│   ├── Caja.js
│   ├── Mesa.js
│   ├── Pedido.js
│   ├── Cliente.js
│   └── Producto.js
├── controllers/           # Lógica de negocio
│   ├── authController.js
│   ├── cajaController.js
│   ├── mesaController.js
│   ├── pedidoController.js
│   ├── clienteController.js
│   └── productoController.js
├── middleware/            # Middlewares personalizados
│   ├── auth.js           # Verificar token JWT
│   ├── errorHandler.js   # Manejo de errores
│   └── validate.js       # Validaciones
├── routes/               # Rutas de la API
│   ├── auth.js
│   ├── caja.js
│   ├── mesas.js
│   ├── pedidos.js
│   ├── clientes.js
│   └── productos.js
├── utils/                # Utilidades
│   └── generateId.js    # Generar IDs únicos
└── index.js              # Archivo principal
```

---

## 2. Sistema de Autenticación y Autorización

### ¿Por qué?
Sin autenticación, cualquiera puede acceder y modificar datos. Esto es crítico en producción.

### Conceptos clave:
- **JWT (JSON Web Token)**: Token que identifica al usuario
- **Hash de contraseñas**: Nunca guardar contraseñas en texto plano
- **Middleware**: Función que se ejecuta antes de las rutas

### Paso 2.1: Crear modelo de Usuario

Crea `server/models/User.js`:

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
    timestamps: true // Crea createdAt y updatedAt automáticamente
});

// Antes de guardar, encriptar la contraseña
userSchema.pre('save', async function(next) {
    // Solo hashear si la contraseña fue modificada
    if (!this.isModified('password')) return next();
    
    // Hashear la contraseña con 10 rondas de sal
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

// Método para comparar contraseñas
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model('User', userSchema);
```

**Explicación:**
- `pre('save')`: Se ejecuta ANTES de guardar en la BD
- `bcrypt.hash()`: Encripta la contraseña
- `comparePassword()`: Compara contraseña ingresada con la guardada

### Paso 2.2: Crear controlador de autenticación

Crea `server/controllers/authController.js`:

```javascript
import User from '../models/User.js';
import jwt from 'jsonwebtoken';

// Función para generar token JWT
const generateToken = (userId) => {
    return jwt.sign(
        { userId }, 
        process.env.JWT_SECRET, 
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

// Registrar nuevo usuario
export const register = async (req, res) => {
    try {
        const { username, email, password, role } = req.body;

        // Verificar si el usuario ya existe
        const userExists = await User.findOne({ 
            $or: [{ email }, { username }] 
        });

        if (userExists) {
            return res.status(400).json({ 
                error: 'El usuario o email ya existe' 
            });
        }

        // Crear nuevo usuario
        const user = await User.create({
            username,
            email,
            password, // Se encriptará automáticamente por el pre('save')
            role: role || 'mozo'
        });

        // Generar token
        const token = generateToken(user._id);

        // Responder sin la contraseña
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

// Iniciar sesión
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Buscar usuario por email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        // Verificar si el usuario está activo
        if (!user.activo) {
            return res.status(401).json({ 
                error: 'Usuario desactivado' 
            });
        }

        // Comparar contraseñas
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas' 
            });
        }

        // Generar token
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

// Obtener usuario actual
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

**Explicación:**
- `jwt.sign()`: Crea un token con el ID del usuario
- `comparePassword()`: Usa el método que creamos en el modelo
- `select('-password')`: Excluye la contraseña de la respuesta

### Paso 2.3: Crear middleware de autenticación

Crea `server/middleware/auth.js`:

```javascript
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Middleware para verificar token JWT
export const authenticate = async (req, res, next) => {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'No se proporcionó token de autenticación' 
            });
        }

        // Extraer el token (quitar "Bearer ")
        const token = authHeader.substring(7);

        // Verificar y decodificar el token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Buscar usuario en la BD
        const user = await User.findById(decoded.userId);
        if (!user || !user.activo) {
            return res.status(401).json({ 
                error: 'Usuario no válido o desactivado' 
            });
        }

        // Agregar información del usuario al request
        req.userId = user._id;
        req.userRole = user.role;
        req.user = user;

        // Continuar con la siguiente función
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

// Middleware para verificar roles
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

**Explicación:**
- `authenticate`: Verifica que el token sea válido
- `authorize`: Verifica que el usuario tenga el rol necesario
- `next()`: Pasa al siguiente middleware o ruta

### Paso 2.4: Crear rutas de autenticación

Crea `server/routes/auth.js`:

```javascript
import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Rutas públicas
router.post('/register', register);
router.post('/login', login);

// Ruta protegida (requiere autenticación)
router.get('/me', authenticate, getMe);

export default router;
```

### Paso 2.5: Actualizar el frontend para usar autenticación

Crea `client/src/utils/auth.js`:

```javascript
// Guardar token en localStorage
export const saveToken = (token) => {
    localStorage.setItem('token', token);
};

// Obtener token de localStorage
export const getToken = () => {
    return localStorage.getItem('token');
};

// Eliminar token
export const removeToken = () => {
    localStorage.removeItem('token');
};

// Configurar axios para enviar token en cada petición
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3000/api',
});

// Interceptor: agregar token a cada petición
api.interceptors.request.use((config) => {
    const token = getToken();
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
            // Token inválido o expirado
            removeToken();
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
```

**Ahora en tus componentes, usa `api` en lugar de `axios`:**

```javascript
// Antes:
import axios from 'axios';
const res = await axios.get('/api/mesas');

// Después:
import api from '../utils/auth';
const res = await api.get('/mesas');
```

---

## 3. Migración a Base de Datos Real

### ¿Por qué?
JSON no es una base de datos real. No soporta:
- Múltiples usuarios simultáneos
- Transacciones
- Consultas complejas
- Escalabilidad

### Conceptos clave:
- **MongoDB**: Base de datos NoSQL (documentos)
- **Mongoose**: ODM (Object Document Mapper) para MongoDB
- **Schema**: Define la estructura de los datos
- **Model**: Representa una colección en la BD

### Paso 3.1: Configurar conexión a MongoDB

Crea `server/config/database.js`:

```javascript
import mongoose from 'mongoose';

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Opciones recomendadas
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        process.exit(1); // Salir si no puede conectar
    }
};

export default connectDB;
```

### Paso 3.2: Crear modelos de datos

**Modelo de Caja** (`server/models/Caja.js`):

```javascript
import mongoose from 'mongoose';

const cajaSchema = new mongoose.Schema({
    fecha: {
        type: String,
        required: true,
        index: true // Para búsquedas rápidas
    },
    montoInicial: {
        type: Number,
        required: true,
        default: 0
    },
    totalEfectivo: {
        type: Number,
        default: 0
    },
    totalTransferencia: {
        type: Number,
        default: 0
    },
    totalDia: {
        type: Number,
        default: 0
    },
    ventas: [{
        pedidoId: String,
        total: Number,
        efectivo: Number,
        transferencia: Number,
        fecha: Date
    }],
    cerrada: {
        type: Boolean,
        default: false
    },
    cerradaAt: Date,
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

export default mongoose.model('Caja', cajaSchema);
```

**Modelo de Mesa** (`server/models/Mesa.js`):

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

**Modelo de Producto** (`server/models/Producto.js`):

```javascript
import mongoose from 'mongoose';

const productoSchema = new mongoose.Schema({
    numero: {
        type: String,
        required: true
    },
    nombre: {
        type: String,
        required: true
    },
    precio: {
        type: Number,
        required: true,
        min: 0
    },
    stock: {
        type: Number,
        default: 0,
        min: 0
    },
    cantidadDisponible: {
        type: Number,
        default: 0,
        min: 0
    },
    categoria: {
        type: String,
        default: 'general'
    }
}, {
    timestamps: true
});

export default mongoose.model('Producto', productoSchema);
```

**Modelo de Cliente** (`server/models/Cliente.js`):

```javascript
import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
    numero: {
        type: String,
        required: true
    },
    nombre: {
        type: String,
        required: true
    },
    cuentaCorriente: {
        type: Number,
        default: 0
    },
    pagos: [{
        monto: Number,
        efectivo: Number,
        transferencia: Number,
        observaciones: String,
        fecha: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

export default mongoose.model('Cliente', clienteSchema);
```

**Modelo de Pedido** (`server/models/Pedido.js`):

```javascript
import mongoose from 'mongoose';

const pedidoSchema = new mongoose.Schema({
    mesaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mesa',
        default: null
    },
    clienteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Cliente',
        default: null
    },
    items: [{
        productoId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Producto'
        },
        nombre: String,
        cantidad: Number,
        precio: Number,
        precioOriginal: Number
    }],
    total: {
        type: Number,
        required: true,
        min: 0
    },
    efectivo: {
        type: Number,
        default: 0
    },
    transferencia: {
        type: Number,
        default: 0
    },
    observaciones: {
        type: String,
        default: ''
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Cobrado', 'Cuenta Corriente'],
        default: 'Pendiente'
    }
}, {
    timestamps: true
});

export default mongoose.model('Pedido', pedidoSchema);
```

### Paso 3.3: Actualizar controladores para usar MongoDB

Ejemplo: `server/controllers/mesaController.js`:

```javascript
import Mesa from '../models/Mesa.js';

// Obtener todas las mesas
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

// Crear nueva mesa
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

// Actualizar mesa
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

// Eliminar mesa
export const deleteMesa = async (req, res) => {
    try {
        const mesa = await Mesa.findByIdAndDelete(req.params.id);

        if (!mesa) {
            return res.status(404).json({ error: 'Mesa no encontrada' });
        }

        res.json({ success: true, message: 'Mesa eliminada' });
    } catch (error) {
        res.status(500).json({ 
            error: 'Error al eliminar mesa',
            message: error.message 
        });
    }
};
```

### Paso 3.4: Actualizar index.js para conectar MongoDB

```javascript
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";

// Cargar variables de entorno
dotenv.config();

// Conectar a MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

// Importar rutas
import authRoutes from './routes/auth.js';
import cajaRoutes from './routes/caja.js';
import mesaRoutes from './routes/mesas.js';
// ... otras rutas

// Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/mesas', mesaRoutes);
// ... otras rutas

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
```

---

## 4. Validación de Inputs

### ¿Por qué?
Sin validación, usuarios pueden enviar datos incorrectos o maliciosos.

### Paso 4.1: Instalar express-validator

```bash
npm install express-validator
```

### Paso 4.2: Crear validadores

Crea `server/middleware/validate.js`:

```javascript
import { body, validationResult } from 'express-validator';

// Middleware para manejar errores de validación
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

// Validaciones para mesas
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

// Validaciones para productos
export const validateProducto = [
    body('nombre')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('precio')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo'),
    body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero positivo'),
    handleValidationErrors
];

// Validaciones para clientes
export const validateCliente = [
    body('nombre')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    handleValidationErrors
];

// Validaciones para pedidos
export const validatePedido = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe tener al menos un item'),
    body('items.*.productoId')
        .notEmpty()
        .withMessage('Cada item debe tener un productoId'),
    body('items.*.cantidad')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser un número entero positivo'),
    body('items.*.precio')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo'),
    handleValidationErrors
];
```

### Paso 4.3: Usar validadores en las rutas

```javascript
import { validateMesa } from '../middleware/validate.js';
import { createMesa, updateMesa } from '../controllers/mesaController.js';

router.post('/mesas', authenticate, validateMesa, createMesa);
router.put('/mesas/:id', authenticate, validateMesa, updateMesa);
```

---

## 5. Mejora del Manejo de Errores

### Paso 5.1: Crear middleware de manejo de errores

Crea `server/middleware/errorHandler.js`:

```javascript
// Middleware centralizado para manejar errores
export const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log del error (en producción usar un servicio de logging)
    console.error(err);

    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = {
            message,
            statusCode: 400
        };
    }

    // Error de duplicado (código 11000 de MongoDB)
    if (err.code === 11000) {
        const message = 'Dato duplicado';
        error = {
            message,
            statusCode: 400
        };
    }

    // Error de cast (ID inválido)
    if (err.name === 'CastError') {
        const message = 'Recurso no encontrado';
        error = {
            message,
            statusCode: 404
        };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Error del servidor'
    });
};

// Clase personalizada para errores
export class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}
```

### Paso 5.2: Usar el error handler en index.js

```javascript
import { errorHandler } from './middleware/errorHandler.js';

// ... tus rutas ...

// Debe ir AL FINAL, después de todas las rutas
app.use(errorHandler);
```

### Paso 5.3: Actualizar controladores para usar AppError

```javascript
import { AppError } from '../middleware/errorHandler.js';

export const getMesa = async (req, res, next) => {
    try {
        const mesa = await Mesa.findById(req.params.id);
        
        if (!mesa) {
            throw new AppError('Mesa no encontrada', 404);
        }
        
        res.json(mesa);
    } catch (error) {
        next(error); // Pasa el error al errorHandler
    }
};
```

---

## 6. Sistema de IDs Únicos (UUID)

### ¿Por qué?
`Date.now()` puede generar IDs duplicados si se crean objetos muy rápido.

### Paso 6.1: Crear utilidad para generar IDs

Crea `server/utils/generateId.js`:

```javascript
import { v4 as uuidv4 } from 'uuid';

export const generateId = () => {
    return uuidv4();
};
```

### Paso 6.2: MongoDB ya usa ObjectId

MongoDB automáticamente genera `_id` únicos. Si necesitas un campo adicional:

```javascript
import { v4 as uuidv4 } from 'uuid';

const mesaSchema = new mongoose.Schema({
    numero: String,
    customId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    // ...
});
```

---

## 7. Estados de Carga

### Paso 7.1: Crear hook personalizado para estados de carga

Crea `client/src/hooks/useAsync.js`:

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

### Paso 7.2: Usar en componentes

```javascript
import { useAsync } from '../hooks/useAsync';
import api from '../utils/auth';

const Mesas = () => {
    const { data: mesas, loading, error } = useAsync(
        () => api.get('/mesas').then(res => res.data),
        []
    );

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="text-white text-xl">Cargando...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-red-400">
                Error: {error.message}
            </div>
        );
    }

    return (
        // Tu código existente
    );
};
```

---

## 8. Refactorización de Código Repetitivo

### Paso 8.1: Crear componentes reutilizables

Crea `client/src/components/Modal.jsx`:

```javascript
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="card bg-slate-800 max-w-md w-full mx-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button 
                        onClick={onClose}
                        className="text-slate-400 hover:text-white"
                    >
                        ✕
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

export default Modal;
```

### Paso 8.2: Crear hooks para lógica repetida

Crea `client/src/hooks/useModal.js`:

```javascript
import { useState } from 'react';

export const useModal = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const openModal = (item = null) => {
        setEditingItem(item);
        setIsOpen(true);
    };

    const closeModal = () => {
        setIsOpen(false);
        setEditingItem(null);
    };

    return { isOpen, editingItem, openModal, closeModal };
};
```

---

## 9. Otras Mejoras Importantes

### 9.1: Variables de entorno en frontend

Crea `client/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

Usa en código:
```javascript
const API_URL = import.meta.env.VITE_API_URL;
```

### 9.2: Rate Limiting

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100 // máximo 100 requests por ventana
});

app.use('/api/', limiter);
```

### 9.3: CORS configurado correctamente

```javascript
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
};
app.use(cors(corsOptions));
```

---

## 📝 Checklist Final

- [ ] Autenticación implementada
- [ ] Base de datos MongoDB configurada
- [ ] Validaciones en todas las rutas
- [ ] Manejo de errores centralizado
- [ ] Estados de carga en frontend
- [ ] Código refactorizado
- [ ] Variables de entorno configuradas
- [ ] Rate limiting activo
- [ ] Tests básicos (opcional pero recomendado)

---

## 🎓 Recursos para Aprender Más

1. **MongoDB University**: Cursos gratuitos de MongoDB
2. **JWT.io**: Documentación de JSON Web Tokens
3. **Express.js Docs**: Documentación oficial
4. **Mongoose Docs**: Documentación de Mongoose

---

**¡Éxito con tu aprendizaje!** 🚀

