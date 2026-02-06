import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'


/* Obtener todas las mesas
 * GET /api/mesas
 */
export const getMesas = asyncHandler(async (req, res) => {
    const { Mesa, AppState } = req.models

    // Reset diario del "nombre" de las mesas (mantiene número/posiciones/config)
    const hoy = getTodayYMD()
    const KEY = 'mesaNombreResetYMD'
    const state = await AppState.findOne({ key: KEY }).lean()
    if (state?.value !== hoy) {
        await Mesa.updateMany({}, { $set: { nombre: '' } })
        await AppState.findOneAndUpdate(
            { key: KEY },
            { $set: { value: hoy } },
            { upsert: true, new: true }
        )
    }

    const mesas = await Mesa.find().sort({ numero: 1 });
    res.json(mesas);
});


/* Crear nueva mesa
 * POST /api/mesas
 */
export const createMesa = asyncHandler(async (req, res) => {
    const { Mesa } = req.models
    const { numero, nombre, x, y, color } = req.body;

    const mesa = await Mesa.create({
        numero,
        nombre: nombre ?? '',
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
    const { Mesa } = req.models
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
    const { Mesa } = req.models
    const mesa = await Mesa.findByIdAndDelete(req.params.id);

    if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    res.json({ success: true });
});