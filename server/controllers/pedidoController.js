import { asyncHandler } from '../middleware/errorHandler.js';
import { formatDateYMD, getArgentinaOffset, getTimeHMS } from '../utils/date.js'


/* Obtener todos los pedidos
 * GET /api/pedidos
 */
export const getPedidos = asyncHandler(async (req, res) => {
    const { Pedido } = req.models
    const pendientes =
        String(req.query?.pendientes || '').toLowerCase() === 'true' ||
        String(req.query?.pendientes || '') === '1'

    const query = {}
    // Si se pide pendientes, excluir cobrados/cancelados
    if (pendientes) {
        query.estado = { $nin: ['Cobrado', 'Cancelado'] }
    }

    // Filtro opcional por fecha (YYYY-MM-DD) en timezone Argentina.
    // Esto evita bajar miles de pedidos y filtrar en el frontend.
    const fechaRaw = req.query?.fecha
    const fecha = typeof fechaRaw === 'string' ? fechaRaw.trim() : ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const start = new Date(`${fecha}T00:00:00.000${getArgentinaOffset()}`)
        const end = new Date(`${fecha}T23:59:59.999${getArgentinaOffset()}`)
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            query.createdAt = { $gte: start, $lte: end }
        }
    }

    // Solo aplicamos límite cuando se pide "pendientes", para no romper usos existentes.
    let limit = null
    if (pendientes) {
        const raw = Number(req.query?.limit)
        if (Number.isFinite(raw) && raw > 0) {
            limit = Math.min(Math.floor(raw), 5000)
        } else {
            limit = 2000
        }
    }

    let q = Pedido.find(query)
        .populate('mesaId', 'numero nombre')
        .populate('clienteId', 'nombre')
        .sort({ createdAt: -1 });

    if (limit) q = q.limit(limit)

    const pedidos = await q
    res.json(pedidos);
});


/* Crear nuevo pedido
 * POST /api/pedidos
 */
export const createPedido = asyncHandler(async (req, res) => {
    const { Pedido, Cliente } = req.models
    const { nombre, mesaId, clienteId, items, total, observaciones, fecha } = req.body;
    const totalNum = parseFloat(total) || 0

    // Determinar estado inicial
    let estado = 'Pendiente';
    if (clienteId) {
        estado = 'Cuenta Corriente';

        // Actualizar cuenta corriente del cliente
        const cliente = await Cliente.findById(clienteId);
        if (cliente) {
            cliente.cuentaCorriente = (parseFloat(cliente.cuentaCorriente) || 0) + totalNum;
            await cliente.save();
        }
    }

    // Si se proporciona una fecha, convertirla a Date para createdAt
    let createdAt = undefined
    if (fecha) {
        // La fecha viene en formato YYYY-MM-DD.
        // IMPORTANTE: el server en Render suele correr en UTC. Si armamos `${fecha}T${hhmmss}` sin offset,
        // el pedido puede "cambiar de día" al verlo en Argentina y la UI lo filtra como si no se hubiera guardado.
        // Por eso construimos el Date con hora Argentina + offset explícito -03:00.
        const hhmmss = getTimeHMS(new Date())
        const fechaDate = new Date(`${fecha}T${hhmmss}${getArgentinaOffset()}`)
        if (!isNaN(fechaDate.getTime())) {
            createdAt = fechaDate
        }
    }

    const pedidoData = {
        nombre: (nombre ?? '').toString(),
        mesaId: mesaId || null,
        clienteId: clienteId || null,
        items: items || [],
        total: totalNum,
        efectivo: 0,
        transferencia: 0,
        observaciones: observaciones || '',
        estado
    }

    // Si hay fecha personalizada, establecer createdAt
    if (createdAt) {
        pedidoData.createdAt = createdAt
        pedidoData.updatedAt = createdAt
    }

    const pedido = await Pedido.create(pedidoData);

    res.status(201).json(pedido);
});


/* Actualizar pedido
 * PUT /api/pedidos/:id
 */
export const updatePedido = asyncHandler(async (req, res) => {
    const { Pedido, Cliente, Caja } = req.models
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoAnterior = pedido.estado;
    const estadoNuevo = req.body.estado;

    // Sanitizar IDs (evita CastError cuando viene "" desde selects)
    if (req.body.mesaId === '') req.body.mesaId = null
    if (req.body.clienteId === '') req.body.clienteId = null

    // 1) Caja: sumar pagos parciales (delta efectivo/transferencia) aunque NO esté Cobrado
    // Esto permite que Caja/Gestión/Métricas reflejen ingresos en tiempo real.
    {
        const prevE = parseFloat(pedido.efectivo) || 0
        const prevT = parseFloat(pedido.transferencia) || 0
        const nextE = req.body.efectivo != null ? (parseFloat(req.body.efectivo) || 0) : prevE
        const nextT = req.body.transferencia != null ? (parseFloat(req.body.transferencia) || 0) : prevT
        const deltaE = nextE - prevE
        const deltaT = nextT - prevT

        if (deltaE !== 0 || deltaT !== 0) {
            // Buscar la caja correcta según la fecha del pedido
            const fechaPedido = formatDateYMD(pedido.createdAt)
            let caja = null
            if (fechaPedido) {
                // Buscar SOLO caja abierta de esa fecha específica (no hacer fallback a otras fechas)
                caja = await Caja.findOne({ fecha: fechaPedido, cerrada: false }).sort({ createdAt: -1 })
            }
            // Solo registrar si encontramos la caja de esa fecha específica
            if (caja) {
                caja.totalEfectivo = (caja.totalEfectivo || 0) + deltaE
                caja.totalTransferencia = (caja.totalTransferencia || 0) + deltaT
                if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
                if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

                if (!caja.ventas) caja.ventas = []
                caja.ventas.push({
                    pedidoId: pedido._id.toString(),
                    tipo: 'pedido',
                    total: (deltaE + deltaT),
                    efectivo: deltaE,
                    transferencia: deltaT,
                    fecha: new Date()
                })

                await caja.save()
            }
        }
    }

    // Si es cuenta corriente (o se asigna/quita cliente), mantener la cuenta corriente sincronizada
    // con el saldo pendiente (total - pagos). Solo aplica mientras NO esté cobrado.
    if (estadoAnterior?.toLowerCase() !== 'cobrado') {
        const oldTotal = parseFloat(pedido.total) || 0
        const oldE = parseFloat(pedido.efectivo) || 0
        const oldT = parseFloat(pedido.transferencia) || 0
        const oldPaid = oldE + oldT
        const oldOutstanding = oldTotal - oldPaid

        const newTotal = req.body.total != null ? (parseFloat(req.body.total) || 0) : oldTotal
        const newE = req.body.efectivo != null ? (parseFloat(req.body.efectivo) || 0) : oldE
        const newT = req.body.transferencia != null ? (parseFloat(req.body.transferencia) || 0) : oldT
        const newPaid = newE + newT
        const newOutstanding = newTotal - newPaid

        const oldClienteId = pedido.clienteId ? pedido.clienteId.toString() : null
        const newClienteId = req.body.clienteId != null
            ? (req.body.clienteId ? req.body.clienteId.toString() : null)
            : oldClienteId

        const adjustCliente = async (clienteId, delta) => {
            if (!clienteId || !delta) return
            const cliente = await Cliente.findById(clienteId)
            if (!cliente) return
            cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) + delta
            await cliente.save()
        }

        if (!oldClienteId && newClienteId) {
            // Se asignó un cliente: sumar el saldo pendiente actual
            await adjustCliente(newClienteId, newOutstanding)
            // Forzar estado cuenta corriente si corresponde
            if (!req.body.estado) req.body.estado = 'Cuenta Corriente'
        } else if (oldClienteId && !newClienteId) {
            // Se quitó el cliente: restar el saldo pendiente anterior
            await adjustCliente(oldClienteId, -oldOutstanding)
        } else if (oldClienteId && newClienteId && oldClienteId !== newClienteId) {
            // Se cambió de cliente: mover el saldo
            await adjustCliente(oldClienteId, -oldOutstanding)
            await adjustCliente(newClienteId, newOutstanding)
            if (!req.body.estado) req.body.estado = 'Cuenta Corriente'
        } else if (oldClienteId && newClienteId && oldClienteId === newClienteId) {
            // Mismo cliente: ajustar por cambios de total y/o pagos
            const deltaTotal = newTotal - oldTotal
            const deltaPaid = newPaid - oldPaid
            // Cuenta corriente aumenta con deltaTotal, y disminuye con lo pagado
            await adjustCliente(oldClienteId, deltaTotal - deltaPaid)
        }
    }

    // Si cambió a "Cobrado"
    const becameCobrado =
        estadoNuevo?.toLowerCase() === 'cobrado' &&
        estadoAnterior?.toLowerCase() !== 'cobrado'

    if (becameCobrado) {
        // Fijar cobradoAt una sola vez (si no existe), para poder auditar/filtrar por momento de cobro
        if (!pedido.cobradoAt) {
            req.body.cobradoAt = new Date()
        }

        // Buscar la caja correcta según la fecha del pedido
        const fechaPedido = formatDateYMD(pedido.createdAt)
        let caja = null
        if (fechaPedido) {
            // Buscar SOLO caja abierta de esa fecha específica (no hacer fallback a otras fechas)
            caja = await Caja.findOne({ fecha: fechaPedido, cerrada: false }).sort({ createdAt: -1 })
        }
        // Solo registrar si encontramos la caja de esa fecha específica
        if (caja) {
            const efectivo = parseFloat(req.body.efectivo) || 0;
            const transferencia = parseFloat(req.body.transferencia) || 0;

            if (!caja.ventas) caja.ventas = [];
            caja.ventas.push({
                pedidoId: pedido._id.toString(),
                total: pedido.total,
                efectivo,
                transferencia,
                fecha: new Date()
            });

            await caja.save();
        }
    }

    // Actualizar pedido
    Object.assign(pedido, req.body);
    await pedido.save();

    res.json(pedido);
});


/* Eliminar pedido
 * DELETE /api/pedidos/:id
 */
export const deletePedido = asyncHandler(async (req, res) => {
    const { Pedido, Cliente, Caja } = req.models
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Si se borra desde Histórico, NO ajustar caja (Histórico usa /api/historico/:id, pero lo soportamos igual)
    const fromHistorico =
        String(req.query?.fromHistorico || '').toLowerCase() === 'true' ||
        String(req.headers?.['x-from-historico'] || '') === '1'

    const estado = String(pedido.estado || '').toLowerCase()
    const efectivo = parseFloat(pedido.efectivo) || 0
    const transferencia = parseFloat(pedido.transferencia) || 0

    // Revertir ingresos parciales en caja si el pedido NO está cobrado y tiene pagos registrados
    if (!fromHistorico && estado !== 'cobrado' && (efectivo !== 0 || transferencia !== 0)) {
        const fechaPedido = formatDateYMD(pedido.createdAt)
        if (fechaPedido) {
            const caja = await Caja.findOne({ fecha: fechaPedido, cerrada: false }).sort({ createdAt: -1 })
            if (caja) {
                caja.totalEfectivo = (caja.totalEfectivo || 0) - efectivo
                caja.totalTransferencia = (caja.totalTransferencia || 0) - transferencia
                if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
                if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

                caja.ventas = Array.isArray(caja.ventas) ? caja.ventas : []
                caja.ventas.push({
                    pedidoId: pedido._id.toString(),
                    tipo: 'pedido',
                    total: -1 * (efectivo + transferencia),
                    efectivo: -1 * efectivo,
                    transferencia: -1 * transferencia,
                    fecha: new Date(),
                })

                await caja.save()
            }
        }
    }

    // Si estaba en cuenta corriente y NO estaba cobrado, mantener cuenta corriente sincronizada (restar saldo pendiente)
    if (!fromHistorico && estado !== 'cobrado' && pedido.clienteId) {
        const total = parseFloat(pedido.total) || 0
        const pagado = (parseFloat(pedido.efectivo) || 0) + (parseFloat(pedido.transferencia) || 0)
        const pendiente = total - pagado
        if (pendiente > 0) {
            const cliente = await Cliente.findById(pedido.clienteId)
            if (cliente) {
                cliente.cuentaCorriente = (parseFloat(cliente.cuentaCorriente) || 0) - pendiente
                if (cliente.cuentaCorriente < 0) cliente.cuentaCorriente = 0
                await cliente.save()
            }
        }
    }

    await Pedido.findByIdAndDelete(req.params.id)
    res.json({ success: true });
});