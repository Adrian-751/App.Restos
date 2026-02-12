import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'


/* Obtener todas las mesas
 * GET /api/mesas
 */
export const getMesas = asyncHandler(async (req, res) => {
    const { Mesa } = req.models
    const mesas = await Mesa.find().sort({ numero: 1 });
    res.json(mesas);
});


/* Crear nueva mesa
 * POST /api/mesas
 */
export const createMesa = asyncHandler(async (req, res) => {
    const { Mesa } = req.models
    const { numero, nombre, x, y, color, fecha } = req.body; // fecha de la caja actual (opcional)

    const mesaData = {
        numero,
        nombre: nombre ?? '',
        x: x || 0,
        y: y || 0,
        color: color || '#e11d48',
        estado: 'libre',
        nombresPorFecha: {}
    }

    // Si se proporciona un nombre y una fecha, guardar el nombre asociado a esa fecha
    if (nombre && nombre.trim() && fecha) {
        mesaData.nombresPorFecha = { [fecha]: nombre.trim() }
    }

    const mesa = await Mesa.create(mesaData);

    res.status(201).json(mesa);
});


/* Actualizar mesa
 * PUT /api/mesas/:id
 */
export const updateMesa = asyncHandler(async (req, res) => {
    const { Mesa } = req.models
    const { fecha } = req.body // Fecha de la caja seleccionada (opcional)

    // Obtener la mesa primero
    let mesa = await Mesa.findById(req.params.id)
    if (!mesa) {
        return res.status(404).json({ error: 'Mesa no encontrada' });
    }

    // Guardar nombresPorFecha antes de actualizar otros campos
    let nombresPorFechaGuardado = null

    // SIEMPRE actualizar nombresPorFecha si se proporciona una fecha
    // Esto permite guardar el nombre para esa fecha específica, o borrarlo si está vacío
    if (fecha) {
        // Guardar el nombre en nombresPorFecha con la fecha como clave
        // Usar objeto plano para evitar problemas con Maps en MongoDB
        if (!mesa.nombresPorFecha || typeof mesa.nombresPorFecha !== 'object') {
            mesa.nombresPorFecha = {}
        }

        // Asegurarse de que nombresPorFecha sea un objeto plano
        const nombresObj = mesa.nombresPorFecha instanceof Map
            ? Object.fromEntries(mesa.nombresPorFecha)
            : (typeof mesa.nombresPorFecha === 'object' && mesa.nombresPorFecha !== null
                ? { ...mesa.nombresPorFecha }
                : {})

        // Si se proporciona un nombre (incluso si está vacío), actualizar nombresPorFecha
        if (req.body.nombre !== undefined) {
            if (req.body.nombre && req.body.nombre.trim()) {
                nombresObj[fecha] = req.body.nombre.trim()
            } else {
                // Si el nombre está vacío, eliminar la entrada de esa fecha
                delete nombresObj[fecha]
            }
            // Guardar como objeto plano
            nombresPorFechaGuardado = nombresObj
            mesa.nombresPorFecha = nombresObj
        }
    }

    // Actualizar otros campos de la mesa (sin incluir fecha y nombre en el body para evitar conflictos)
    const { fecha: _, nombre: __, ...updateData } = req.body
    Object.assign(mesa, updateData)

    // Restaurar nombresPorFecha si se guardó
    if (nombresPorFechaGuardado !== null) {
        mesa.nombresPorFecha = nombresPorFechaGuardado
    }

    await mesa.save()

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