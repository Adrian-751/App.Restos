import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener estado de la caja del día
 * GET /api/caja/estado
 */
export const getEstado = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const hoy = new Date().toISOString().split('T')[0];
    const caja = await Caja.findOne({ fecha: hoy, cerrada: false });

    res.json(caja || null);
});


/* Abrir caja
* POST /api/caja/abrir
*/
export const abrirCaja = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const { montoInicial } = req.body;
    const hoy = new Date().toISOString().split('T')[0];

    // Verificar si ya hay una caja abierta hoy
    const cajaExistente = await Caja.findOne({ fecha: hoy, cerrada: false });
    if (cajaExistente) {
        return res.status(400).json({ error: 'Ya existe una caja abierta hoy' });
    }

    const caja = await Caja.create({
        fecha: hoy,
        montoInicial: parseFloat(montoInicial) || 0,
        ventas: [],
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
    const fecha = req.params.fecha || new Date().toISOString().split('T')[0];
    const cajas = await Caja.find({ fecha });

    res.json(cajas);
});