import mongoose from 'mongoose';

const loteSchema = new mongoose.Schema({
    productoId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    productoNombre: {
        type: String,
        required: true,
        trim: true
    },
    cantidad: {
        type: Number,
        required: true,
        min: 1
    },
    observaciones: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

export const getLoteModel = (conn) => conn.models.Lote || conn.model('Lote', loteSchema)

export default mongoose.model('Lote', loteSchema);
