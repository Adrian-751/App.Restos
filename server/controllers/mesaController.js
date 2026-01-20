import Mesa from '../models/Mesa.js';
import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener todas las mesas
 * GET /api/mesas
 */
export const getMesas = asyncHandler(async (req, res) => {
    const mesas = await Mesa.find().sort({ numero: 1 });
    res.json(mesas);
});


/* Crear nueva mesa
 * POST /api/mesas
 */
export const createMesa = asyncHandler(async (req, res) => {
    const { numero, nombre, x, y, color } = req.body;

    const mesa = await Mesa.create({
        numero,
        nombre: nombre || `Mesa ${numero}`,
        x: x || 0,
        y: y || 0,
        color: color || '#e11d48',
        estado: 'libre'
    });

    res.status(201).json(mesa);
});


/* Actualizar mesa
 * PUT /api/mesas/:id
 */
export const updateMesa = asyncHandler(async (req, res) => {
    const mesa = await Mesa.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    res.json(mesa);
});


/* Eliminar mesa
 * DELETE /api/mesas/:id
 */
export const deleteMesa = asyncHandler(async (req, res) => {
    const mesa = await Mesa.findByIdAndDelete(req.params.id);

    if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    res.json({ success: true });
});