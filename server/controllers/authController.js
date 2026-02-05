import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Genera un token JWT para el usuario
 */
const generateToken = (userId, tenant) => {
    return jwt.sign(
        { userId, tenant },
        process.env.JWT_SECRET,
        // Para que la sesión se mantenga (tipo Instagram/WhatsApp), usamos 30 días por defecto.
        { expiresIn: process.env.JWT_EXPIRES_IN || '30d' }
    );
};

/**
 * Registro de nuevo usuario
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
    let { email, password, nombre, role } = req.body;
    const { User } = req.models

    email = (email || '').toString().trim().toLowerCase()

    // Verificar si el usuario ya existe
    const userExists = await User.findOne({ email });
    if (userExists) {
        return res.status(400).json({ error: 'El usuario ya existe' });
    }

    // Crear nuevo usuario
    const user = await User.create({
        email,
        password,
        nombre,
        role: role || 'mesero'
    });

    // Generar token
    const token = generateToken(user._id, req.tenant);

    res.status(201).json({
        message: 'Usuario creado exitosamente',
        token,
        user: {
            id: user._id,
            email: user.email,
            nombre: user.nombre,
            role: user.role
        }
    });
});

/**
 * Login de usuario
 * POST /api/auth/login
 */
export const login = asyncHandler(async (req, res) => {
    let { email, password } = req.body;
    const { User } = req.models
    email = (email || '').toString().trim().toLowerCase()
    password = (password || '').toString()

    // Buscar usuario
    const user = await User.findOne({ email });
    if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Verificar si está activo
    if (!user.activo) {
        return res.status(401).json({ error: 'Usuario inactivo' });
    }

    // Verificar contraseña
    let isPasswordValid = await user.comparePassword(password);

    // Compatibilidad: si el usuario viene de una versión vieja con contraseña en texto plano,
    // y coincide, la migramos automáticamente a bcrypt al primer login.
    // (bcrypt hashes suelen empezar con "$2")
    if (!isPasswordValid) {
        const stored = user.password
        const looksHashed = typeof stored === 'string' && stored.startsWith('$2')
        if (!looksHashed && typeof stored === 'string' && stored === password) {
            user.password = password
            await user.save() // dispara pre('save') y hashea
            isPasswordValid = true
        }
    }

    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = generateToken(user._id, req.tenant);

    res.json({
        message: 'Login exitoso',
        token,
        user: {
            id: user._id,
            email: user.email,
            nombre: user.nombre,
            role: user.role
        }
    });
});

/**
 * Obtener perfil del usuario actual
 * GET /api/auth/me
 */
export const getMe = asyncHandler(async (req, res) => {
    if (!req.userId) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    const { User } = req.models
    const user = await User.findById(req.userId);

    if (!user) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    res.json({
        user: {
            id: user._id,
            email: user.email,
            nombre: user.nombre,
            role: user.role,
            activo: user.activo
        }
    });
});