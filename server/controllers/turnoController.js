import { asyncHandler } from '../middleware/errorHandler.js';
import { formatDateYMD, getArgentinaOffset, getTimeHMS } from '../utils/date.js'

/**
 * Obtener todos los turnos (excluyendo los eliminados de la sección Turnos)
 * GET /api/turnos
 */
export const getTurnos = asyncHandler(async (req, res) => {
    const { Turno } = req.models
    // Filtrar turnos que fueron eliminados de esta sección
    const turnos = await Turno.find({ eliminadoDeTurnos: { $ne: true } })
        .populate('mesaId', 'numero nombre')
        .populate('clienteId', 'numero nombre')
        .populate({
            path: 'pedidoId',
            populate: [
                {
                    path: 'mesaId',
                    select: 'numero nombre'
                },
                {
                    path: 'clienteId',
                    select: 'nombre'
                }
            ]
        })
        .sort({ createdAt: -1 });

    // Enriquecer con información adicional
    const turnosCompletos = turnos.map((turno) => {
        const turnoObj = turno.toObject();

        // Si tiene mesa asignada directamente
        if (turno.mesaId) {
            turnoObj.mesaNombre = turno.mesaId.nombre;
            turnoObj.mesaNumero = turno.mesaId.numero;
        }

        // Si tiene cliente asignado directamente
        if (turno.clienteId) {
            turnoObj.clienteNombre = turno.clienteId.nombre;
            turnoObj.clienteNumero = turno.clienteId.numero;
        }

        // Si tiene pedido, agregar información
        if (turno.pedidoId) {
            const pedido = turno.pedidoId;
            turnoObj.pedidoInfo = {
                id: pedido._id,
                total: pedido.total,
                estado: pedido.estado
            };

            // Si no hay mesa asignada directamente, usar la del pedido
            if (!turnoObj.mesaNombre && pedido.mesaId) {
                turnoObj.mesaNombre = pedido.mesaId.nombre;
                turnoObj.mesaNumero = pedido.mesaId.numero;
            }

            // Si no hay cliente asignado directamente, usar el del pedido
            if (!turnoObj.clienteNombre && pedido.clienteId) {
                turnoObj.clienteNombre = pedido.clienteId.nombre;
            }
        }

        return turnoObj;
    });

    res.json(turnosCompletos);
});

/**
 * Crear nuevo turno
 * POST /api/turnos
 */
export const createTurno = asyncHandler(async (req, res) => {
    const { Turno, Caja } = req.models
    const { nombre, pedidoId, mesaId, clienteId, total, efectivo, transferencia, observaciones, fecha } = req.body;

    // Si se proporciona una fecha, usar esa fecha para contar turnos y crear el turno
    // Si no, usar la fecha de hoy
    let fechaBase = new Date()
    if (fecha) {
        // La fecha viene en formato YYYY-MM-DD, convertir a Date
        const fechaDate = new Date(fecha + 'T12:00:00') // Usar mediodía para evitar problemas de timezone
        if (!isNaN(fechaDate.getTime())) {
            fechaBase = fechaDate
        }
    }

    // Contar turnos del día para asignar número automático
    const inicioDia = new Date(fechaBase)
    inicioDia.setHours(0, 0, 0, 0)
    const finDia = new Date(fechaBase)
    finDia.setHours(23, 59, 59, 999)

    const turnosDia = await Turno.countDocuments({
        createdAt: { $gte: inicioDia, $lte: finDia }
    })

    const numeroTurno = turnosDia + 1

    const turnoData = {
        nombre: nombre || '',
        numero: numeroTurno,
        pedidoId: pedidoId || null,
        mesaId: mesaId || null,
        clienteId: clienteId || null,
        total: parseFloat(total) || 0,
        efectivo: parseFloat(efectivo) || 0,
        transferencia: parseFloat(transferencia) || 0,
        observaciones: observaciones || '',
        estado: 'Pendiente'
    }

    // Si hay fecha personalizada, establecer createdAt
    if (fecha) {
        const hhmmss = getTimeHMS(new Date())
        const fechaDate = new Date(`${fecha}T${hhmmss}${getArgentinaOffset()}`)
        if (!isNaN(fechaDate.getTime())) {
            turnoData.createdAt = fechaDate
            turnoData.updatedAt = fechaDate
        }
    }

    const turno = await Turno.create(turnoData)

    // Si se creó con pago inicial, impactar caja inmediatamente (misma lógica que pagos parciales)
    {
        const e0 = parseFloat(turno.efectivo) || 0
        const t0 = parseFloat(turno.transferencia) || 0
        if (e0 !== 0 || t0 !== 0) {
            const fechaTurno = formatDateYMD(turno.createdAt)
            if (fechaTurno) {
                const caja = await Caja.findOne({ fecha: fechaTurno, cerrada: false }).sort({ createdAt: -1 })
                if (caja) {
                    caja.totalEfectivo = (caja.totalEfectivo || 0) + e0
                    caja.totalTransferencia = (caja.totalTransferencia || 0) + t0
                    if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
                    if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

                    caja.ventas = Array.isArray(caja.ventas) ? caja.ventas : []
                    caja.ventas.push({
                        turnoId: turno._id.toString(),
                        tipo: 'turno',
                        total: (e0 + t0),
                        efectivo: e0,
                        transferencia: t0,
                        fecha: new Date(),
                    })
                    await caja.save()
                }
            }
        }
    }

    res.status(201).json(turno)
})

/**
 * Actualizar turno
 * PUT /api/turnos/:id
 */
export const updateTurno = asyncHandler(async (req, res) => {
    const { Turno, Caja } = req.models
    const turno = await Turno.findById(req.params.id);

    if (!turno) {
        return res.status(404).json({ error: 'Turno no encontrado' });
    }

    // Sanitizar body: descartar campos internos y normalizar objetos poblados
    const body = { ...req.body }
    delete body._id
    delete body.__v
    delete body.createdAt
    delete body.updatedAt
    delete body.id
    if (body.pedidoId && typeof body.pedidoId === 'object') {
        body.pedidoId = body.pedidoId._id ? body.pedidoId._id.toString() : null
    }
    if (body.mesaId && typeof body.mesaId === 'object') {
        body.mesaId = body.mesaId._id ? body.mesaId._id.toString() : null
    }
    if (body.clienteId && typeof body.clienteId === 'object') {
        body.clienteId = body.clienteId._id ? body.clienteId._id.toString() : null
    }

    const estadoAnterior = turno.estado;
    const estadoNuevo = body.estado;

    // Snapshot de pagos anteriores
    const prevE = parseFloat(turno.efectivo) || 0
    const prevT = parseFloat(turno.transferencia) || 0

    const becameCobrado =
        estadoNuevo?.toLowerCase() === 'cobrado' &&
        estadoAnterior?.toLowerCase() !== 'cobrado'

    if (becameCobrado && !turno.cobradoAt) {
        body.cobradoAt = new Date()
    }

    // Guardar turno primero (valida datos antes de tocar caja)
    Object.assign(turno, body);
    await turno.save();

    // Turno guardado OK: actualizar caja con delta de pagos
    const nextE = parseFloat(turno.efectivo) || 0
    const nextT = parseFloat(turno.transferencia) || 0
    const deltaE = nextE - prevE
    const deltaT = nextT - prevT

    if (deltaE !== 0 || deltaT !== 0) {
        const fechaTurnoYMD = formatDateYMD(turno.createdAt)
        const caja = fechaTurnoYMD
            ? await Caja.findOne({ fecha: fechaTurnoYMD, cerrada: false }).sort({ createdAt: -1 })
            : null

        if (caja) {
            caja.totalEfectivo = (caja.totalEfectivo || 0) + deltaE
            caja.totalTransferencia = (caja.totalTransferencia || 0) + deltaT
            if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
            if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

            if (!caja.ventas) caja.ventas = []
            caja.ventas.push({
                turnoId: turno._id.toString(),
                tipo: 'turno',
                total: (deltaE + deltaT),
                efectivo: deltaE,
                transferencia: deltaT,
                fecha: new Date()
            })

            await caja.save()
        }
    }

    res.json(turno);
});

/**
 * Eliminar turno
 * DELETE /api/turnos/:id
 */
export const deleteTurno = asyncHandler(async (req, res) => {
    const { Turno, Caja } = req.models
    const turno = await Turno.findById(req.params.id);

    if (!turno) {
        return res.status(404).json({ error: 'Turno no encontrado' });
    }

    // Si el turno está cobrado, marcarlo como eliminado de Turnos pero mantenerlo para Histórico
    if (turno.estado?.toLowerCase() === 'cobrado') {
        turno.eliminadoDeTurnos = true;
        await turno.save();
        return res.json({
            success: true,
            message: 'Turno removido de la sección Turnos, pero permanece en Histórico'
        });
    }

    // Para turnos no cobrados, si tuvo pagos parciales, revertir caja (misma fecha del turno)
    const efectivo = parseFloat(turno.efectivo) || 0
    const transferencia = parseFloat(turno.transferencia) || 0
    if (efectivo !== 0 || transferencia !== 0) {
        const fechaTurnoYMD = formatDateYMD(turno.createdAt)
        const caja = fechaTurnoYMD
            ? await Caja.findOne({ fecha: fechaTurnoYMD, cerrada: false }).sort({ createdAt: -1 })
            : null
        if (caja) {
            caja.totalEfectivo = (caja.totalEfectivo || 0) - efectivo
            caja.totalTransferencia = (caja.totalTransferencia || 0) - transferencia
            if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
            if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

            caja.ventas = Array.isArray(caja.ventas) ? caja.ventas : []
            caja.ventas.push({
                turnoId: turno._id.toString(),
                tipo: 'turno',
                total: -1 * (efectivo + transferencia),
                efectivo: -1 * efectivo,
                transferencia: -1 * transferencia,
                fecha: new Date(),
            })
            await caja.save()
        }
    }

    // Para turnos no cobrados, eliminarlos normalmente
    await Turno.findByIdAndDelete(req.params.id);

    res.json({ success: true });
});