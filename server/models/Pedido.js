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
        subtotal: Number
    }],
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
        enum: ['Pendiente', 'Cuenta Corriente', 'Cobrado', 'Cancelado'],
        default: 'Pendiente'
    }
}, {
    timestamps: true
});

// Índice para búsquedas por estado
pedidoSchema.index({ estado: 1, createdAt: -1 });

export const getPedidoModel = (conn) => conn.models.Pedido || conn.model('Pedido', pedidoSchema)

export default mongoose.model('Pedido', pedidoSchema);