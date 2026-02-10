import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'

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
    const { Turno } = req.models
    const { nombre, pedidoId, mesaId, clienteId, total, efectivo, transferencia, observaciones } = req.body;

    // Contar turnos del día para asignar número automático
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const finDia = new Date(hoy);
    finDia.setHours(23, 59, 59, 999);

    const turnosHoy = await Turno.countDocuments({
        createdAt: { $gte: hoy, $lte: finDia }
    });

    const numeroTurno = turnosHoy + 1;

    const turno = await Turno.create({
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
    });

    res.status(201).json(turno);
});

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

    const estadoAnterior = turno.estado;
    const estadoNuevo = req.body.estado;

    // 1) Caja: sumar pagos parciales (delta efectivo/transferencia) aunque NO esté Cobrado
    {
        const prevE = parseFloat(turno.efectivo) || 0
        const prevT = parseFloat(turno.transferencia) || 0
        const nextE = req.body.efectivo != null ? (parseFloat(req.body.efectivo) || 0) : prevE
        const nextT = req.body.transferencia != null ? (parseFloat(req.body.transferencia) || 0) : prevT
        const deltaE = nextE - prevE
        const deltaT = nextT - prevT

        if (deltaE !== 0 || deltaT !== 0) {
            // Buscar cualquier caja abierta, sin importar la fecha
            const caja = await Caja.findOne({ cerrada: false }).sort({ createdAt: -1 })
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
    }

    // Si cambió a "Cobrado"
    if (estadoNuevo?.toLowerCase() === 'cobrado' &&
        estadoAnterior?.toLowerCase() !== 'cobrado') {

        // Actualizar caja (buscar cualquier caja abierta, sin importar la fecha)
        const caja = await Caja.findOne({ cerrada: false }).sort({ createdAt: -1 });

        if (caja) {
            const efectivo = parseFloat(req.body.efectivo) || turno.efectivo || 0;
            const transferencia = parseFloat(req.body.transferencia) || turno.transferencia || 0;
            const total = parseFloat(req.body.total) || turno.total || 0;

            if (!caja.ventas) caja.ventas = [];
            caja.ventas.push({
                turnoId: turno._id.toString(),
                tipo: 'turno',
                total: total,
                efectivo: efectivo,
                transferencia: transferencia,
                fecha: new Date()
            });

            await caja.save();
        }
    }

    // Actualizar turno
    Object.assign(turno, req.body);
    await turno.save();

    res.json(turno);
});

/**
 * Eliminar turno
 * DELETE /api/turnos/:id
 */
export const deleteTurno = asyncHandler(async (req, res) => {
    const { Turno } = req.models
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

    // Para turnos no cobrados, eliminarlos normalmente
    await Turno.findByIdAndDelete(req.params.id);

    res.json({ success: true });
});