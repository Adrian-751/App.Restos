import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();


/* Conecta a MongoDB usando Mongoose
* Esta función se ejecuta al iniciar el servidor
*/
export const connectDB = async () => {
    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/app-restos';

        await mongoose.connect(mongoURI, {
            // Opciones de conexión (ya no necesarias en versiones recientes, pero las dejamos por compatibilidad)
        });

        console.log('✅ MongoDB conectado exitosamente');
    } catch (error) {
        console.error('❌ Error conectando a MongoDB:', error.message);
        process.exit(1); // Detiene el servidor si no puede conectar
    }
};


/* Maneja eventos Y errores de conexión
*/
mongoose.connection.on('disconnected', () => {
    console.log('⚠️ MongoDB desconectado');
});

mongoose.connection.on('error', (err) => {
    console.error('❌ Error de MongoDB:', err);
});