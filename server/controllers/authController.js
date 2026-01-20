import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Genera un token JWT para el usuario
 */
const generateToken = (userId) => {
    return jwt.sign(
        { userId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

/**
 * Registro de nuevo usuario
 * POST /api/auth/register
 */
export const register = asyncHandler(async (req, res) => {
    const { email, password, nombre, role } = req.body;

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
    const token = generateToken(user._id);

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
    const { email, password } = req.body;

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
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    // Generar token
    const token = generateToken(user._id);

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