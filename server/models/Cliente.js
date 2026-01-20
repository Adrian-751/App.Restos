import mongoose from 'mongoose';

const clienteSchema = new mongoose.Schema({
    numero: {
        type: Number,
        required: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true
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
    }],
    contacto: {
        telefono: String,
        email: String,
        direccion: String
    }
}, {
    timestamps: true
});

export default mongoose.model('Cliente', clienteSchema);