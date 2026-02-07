import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'


/* Obtener estado de la caja del día
 * GET /api/caja/estado
 */
export const getEstado = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const hoy = getTodayYMD();
    const caja = await Caja.findOne({ fecha: hoy, cerrada: false });

    res.json(caja || null);
});


/* Abrir caja
* POST /api/caja/abrir
*/
export const abrirCaja = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const { montoInicial } = req.body;
    const hoy = getTodayYMD();

    // Verificar si ya hay una caja abierta hoy
    const cajaExistente = await Caja.findOne({ fecha: hoy, cerrada: false });
    if (cajaExistente) {
        return res.status(400).json({ error: 'Ya existe una caja abierta hoy' });
    }

    const caja = await Caja.create({
        fecha: hoy,
        montoInicial: parseFloat(montoInicial) || 0,
        ventas: [],
        egresos: [],
        totalEfectivo: 0,
        totalTransferencia: 0,
        cerrada: false,
        usuarioId: req.userId || null
    });

    res.status(201).json(caja);
});


/* Cerrar caja
* POST /api/caja/cerrar
*/
export const cerrarCaja = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const { id } = req.body;
    const caja = await Caja.findById(id);

    if (!caja) {
        return res.status(404).json({ error: 'Caja no encontrada' });
    }

    if (caja.cerrada) {
        return res.status(400).json({ error: 'La caja ya está cerrada' });
    }

    caja.cerrada = true;
    caja.cerradaAt = new Date();
    caja.totalDia = (caja.totalEfectivo || 0) + (caja.totalTransferencia || 0);

    await caja.save();

    res.json(caja);
});


/* Obtener resumen de cajas por fecha
* GET /api/caja/resumen/:fecha?
*/
export const getResumen = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const fecha = req.params.fecha || getTodayYMD();
    const cajas = await Caja.find({ fecha });

    res.json(cajas);
});

/**
 * Registrar egreso en caja abierta del día
 * POST /api/caja/egreso
 */
export const registrarEgreso = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const hoy = getTodayYMD()
    const caja = await Caja.findOne({ fecha: hoy, cerrada: false })

    if (!caja) {
        return res.status(400).json({ error: 'No hay una caja abierta hoy' })
    }

    const efectivo = parseFloat(req.body.efectivo) || 0
    const transferencia = parseFloat(req.body.transferencia) || 0
    const observaciones = (req.body.observaciones || '').toString()

    if (efectivo < 0 || transferencia < 0) {
        return res.status(400).json({ error: 'Montos inválidos' })
    }
    if (efectivo === 0 && transferencia === 0) {
        return res.status(400).json({ error: 'Debes ingresar un egreso en efectivo o transferencia' })
    }

    caja.egresos = Array.isArray(caja.egresos) ? caja.egresos : []
    caja.egresos.push({ efectivo, transferencia, observaciones, fecha: new Date() })
    await caja.save()

    res.status(201).json(caja)
})