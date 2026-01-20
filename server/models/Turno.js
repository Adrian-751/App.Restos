import mongoose from 'mongoose';

const turnoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        default: ''
    },
    numero: {
        type: Number,
        required: true
    },
    pedidoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pedido',
        default: null
    },
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
    total: {
        type: Number,
        required: true,
        default: 0,
        min: 0
    },
    efectivo: {
        type: Number,
        default: 0,
        min: 0
    },
    transferencia: {
        type: Number,
        default: 0,
        min: 0
    },
    observaciones: {
        type: String,
        default: ''
    },
    estado: {
        type: String,
        enum: ['Pendiente', 'Cobrado', 'Cancelado'],
        default: 'Pendiente'
    },
    eliminadoDeTurnos: {
        type: Boolean,
        default: false
        // Cuando un turno cobrado se elimina de la sección Turnos,
        // se marca como true pero se mantiene para Histórico
    }
}, {
    timestamps: true // createdAt y updatedAt automáticamente
});

// Índice para búsquedas por estado y fecha
turnoSchema.index({ estado: 1, createdAt: -1 });
turnoSchema.index({ eliminadoDeTurnos: 1 });

export default mongoose.model('Turno', turnoSchema);