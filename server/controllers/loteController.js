import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Obtener todos los lotes con info del producto
 * GET /api/lotes
 */
export const getLotes = asyncHandler(async (req, res) => {
    const { Lote } = req.models
    const lotes = await Lote.find().sort({ createdAt: -1 });
    res.json(lotes);
});

/**
 * Crear nuevo lote y actualizar stock del producto
 * POST /api/lotes
 */
export const createLote = asyncHandler(async (req, res) => {
    const { Lote, Producto } = req.models
    const { productoId, cantidad, observaciones } = req.body;

    if (!productoId) return res.status(400).json({ error: 'productoId es requerido' });
    const cantidadNum = parseInt(cantidad);
    if (!cantidadNum || cantidadNum < 1) return res.status(400).json({ error: 'La cantidad debe ser un entero positivo' });

    const producto = await Producto.findById(productoId);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const lote = await Lote.create({
        productoId,
        productoNombre: producto.nombre,
        cantidad: cantidadNum,
        observaciones: observaciones || ''
    });

    await Producto.findByIdAndUpdate(productoId, {
        $inc: { stock: cantidadNum, cantidadDisponible: cantidadNum }
    });

    res.status(201).json(lote);
});

/**
 * Eliminar lote y revertir stock del producto
 * DELETE /api/lotes/:id
 */
export const deleteLote = asyncHandler(async (req, res) => {
    const { Lote, Producto } = req.models
    const lote = await Lote.findByIdAndDelete(req.params.id);

    if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

    await Producto.findByIdAndUpdate(lote.productoId, {
        $inc: { stock: -lote.cantidad, cantidadDisponible: -lote.cantidad }
    });

    res.json({ success: true });
});
