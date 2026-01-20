import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { connectDB } from '../config/database.js';
import User from '../models/User.js';

/**
 * Crea (o actualiza) un usuario admin y devuelve un token JWT.
 *
 * Variables opcionales en .env:
 * - ADMIN_EMAIL
 * - ADMIN_PASSWORD
 * - ADMIN_NOMBRE
 */
const main = async () => {
    try {
        await connectDB();

        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET no está configurado. Configúralo en server/.env');
        }

        const email = process.env.ADMIN_EMAIL || 'admin@admin.com';
        const password = process.env.ADMIN_PASSWORD || 'admin123';
        const nombre = process.env.ADMIN_NOMBRE || 'Administrador';

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                email,
                password,
                nombre,
                role: 'admin',
                activo: true,
            });
            console.log(`✅ Admin creado: ${email}`);
        } else {
            // Asegurar rol/estado, sin tocar password si no hace falta
            const needsUpdate = user.role !== 'admin' || user.activo !== true || user.nombre !== nombre;
            if (needsUpdate) {
                user.role = 'admin';
                user.activo = true;
                user.nombre = nombre;
                await user.save();
                console.log(`✅ Admin actualizado: ${email}`);
            } else {
                console.log(`ℹ️ Admin ya existe: ${email}`);
            }
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
        });

        console.log('\nTOKEN (copiar a localStorage como "token"):\n');
        console.log(token);
    } finally {
        await mongoose.connection.close().catch(() => {});
    }
};

main().catch((err) => {
    console.error('❌ Error creando admin:', err.message || err);
    process.exit(1);
});

