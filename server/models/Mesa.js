import mongoose from 'mongoose';

const mesaSchema = new mongoose.Schema({
    numero: {
        type: Number,
        required: true,
        unique: true
    },
    nombre: {
        type: String,
        default: '',
        trim: true
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

export const getMesaModel = (conn) => conn.models.Mesa || conn.model('Mesa', mesaSchema)

export default mongoose.model('Mesa', mesaSchema);