import mongoose from 'mongoose';

const pedidoSchema = new mongoose.Schema({
    nombre: {
        type: String,
        default: '',
        trim: true
    },
    mesaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Mesa',
        default: null
    },
    mesaNombre: {
        type: String,
        default: '',
        trim: true
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
    },
    cobradoAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

// Índice compuesto para ?pendientes=true (filtra por estado, ordena por fecha)
pedidoSchema.index({ estado: 1, createdAt: -1 });
// Índice para filtro puro por fecha (GET /api/pedidos?fecha=YYYY-MM-DD)
pedidoSchema.index({ createdAt: -1 });
// Índice para consultas de cuenta corriente por cliente
pedidoSchema.index({ clienteId: 1, estado: 1 });

export const getPedidoModel = (conn) => conn.models.Pedido || conn.model('Pedido', pedidoSchema)

export default mongoose.model('Pedido', pedidoSchema);