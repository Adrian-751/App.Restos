import mongoose from 'mongoose';

const productoSchema = new mongoose.Schema({
    numero: {
        type: Number,
        required: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true
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
    },
    descripcion: String,
    imagen: String,
    activo: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

export default mongoose.model('Producto', productoSchema);