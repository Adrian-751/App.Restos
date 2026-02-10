import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'


/* Obtener estado de la caja del día
 * GET /api/caja/estado
 */
export const getEstado = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    // Buscar cualquier caja abierta (sin importar la fecha)
    // Esto evita que se "cierre" automáticamente al cambiar la fecha
    const caja = await Caja.findOne({ cerrada: false }).sort({ createdAt: -1 });

    res.json(caja || null);
});


/* Abrir caja
* POST /api/caja/abrir
*/
export const abrirCaja = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const { montoInicial, fecha, permitirMultiples } = req.body;

    // Usar la fecha proporcionada o la de hoy por defecto
    const fechaCaja = fecha || getTodayYMD();
    const hoy = getTodayYMD();

    // Si no se permite múltiples cajas y ya hay una abierta, verificar
    if (!permitirMultiples) {
        const cajaAbiertaExistente = await Caja.findOne({ cerrada: false });
        if (cajaAbiertaExistente) {
            return res.status(400).json({ error: `Ya existe una caja abierta (fecha: ${cajaAbiertaExistente.fecha}). Debes cerrarla antes de abrir una nueva.` });
        }
    } else {
        // Si se permite múltiples, solo verificar que no haya otra caja abierta para la misma fecha
        const cajaAbiertaMismaFecha = await Caja.findOne({ fecha: fechaCaja, cerrada: false });
        if (cajaAbiertaMismaFecha) {
            return res.json(cajaAbiertaMismaFecha); // Ya existe una caja abierta para esa fecha, retornarla
        }
    }

    // Buscar si ya existe una caja (abierta o cerrada) para esa fecha
    const cajaExistente = await Caja.findOne({ fecha: fechaCaja }).sort({ createdAt: -1 });

    if (cajaExistente) {
        // Si existe, REABRIR la caja (mantener todos los datos existentes)
        if (cajaExistente.cerrada) {
            // Si estaba cerrada, reabrirla
            cajaExistente.cerrada = false;
            cajaExistente.cerradaAt = undefined;
            // Solo actualizar monto inicial si se proporciona explícitamente en el body
            // (no actualizar si es undefined o si no viene en el body)
            if (montoInicial !== undefined && montoInicial !== null && req.body.hasOwnProperty('montoInicial')) {
                cajaExistente.montoInicial = parseFloat(montoInicial) || 0;
            }
            // Si no se proporciona monto inicial, mantener el anterior
            await cajaExistente.save();
            return res.json(cajaExistente);
        } else {
            // Si ya está abierta, retornarla (sin modificar nada)
            return res.json(cajaExistente);
        }
    }

    // Si no existe, crear una nueva caja
    // Si no se proporciona monto inicial, usar 0 por defecto
    const caja = await Caja.create({
        fecha: fechaCaja,
        montoInicial: (montoInicial !== undefined && montoInicial !== null) ? (parseFloat(montoInicial) || 0) : 0,
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
    const { fecha } = req.body // Opcional: fecha de la caja donde registrar el egreso

    let caja
    if (fecha) {
        // Si se especifica una fecha, buscar la caja abierta de esa fecha
        caja = await Caja.findOne({ fecha, cerrada: false }).sort({ createdAt: -1 })
    } else {
        // Si no se especifica, buscar la caja abierta más reciente (principal)
        caja = await Caja.findOne({ cerrada: false }).sort({ createdAt: -1 })
    }

    if (!caja) {
        return res.status(400).json({ error: 'No hay una caja abierta' })
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

/**
 * Obtener todas las cajas (con filtro opcional)
 * GET /api/caja/todas?cerradas=true
 */
export const getTodasCajas = asyncHandler(async (req, res) => {
    const { Caja } = req.models
    const { cerradas } = req.query

    let query = {}
    if (cerradas === 'true') {
        query.cerrada = true
    } else if (cerradas === 'false') {
        query.cerrada = false
    }

    const cajas = await Caja.find(query).sort({ fecha: -1, createdAt: -1 })
    res.json(cajas)
})