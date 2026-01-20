import mongoose from 'mongoose';

const cajaSchema = new mongoose.Schema({
    fecha: {
        type: String,
        required: true,
        index: true // Índice para búsquedas rápidas
    },
    montoInicial: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    totalEfectivo: {
        type: Number,
        default: 0,
        min: 0
    },
    totalTransferencia: {
        type: Number,
        default: 0,
        min: 0
    },
    totalDia: {
        type: Number,
        default: 0
    },
    ventas: [{
        pedidoId: String,
        turnoId: String,
        tipo: String, // 'pedido' o 'turno'
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

// Índice compuesto para búsquedas por fecha y estado
cajaSchema.index({ fecha: 1, cerrada: 1 });

export default mongoose.model('Caja', cajaSchema);