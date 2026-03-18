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
    // Rango: fecha 00:00 hasta (fecha+1) 05:59 para incluir turno nocturno (caja hasta 1-2am).
    const fechaRaw = req.query?.fecha
    const fecha = typeof fechaRaw === 'string' ? fechaRaw.trim() : ''
    if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        const start = new Date(`${fecha}T00:00:00.000${getArgentinaOffset()}`)
        const end = new Date(`${fecha}T23:59:59.999${getArgentinaOffset()}`)
        const [y, m, d] = fecha.split('-').map(Number)
        const nextDay = new Date(y, m - 1, d + 1)
        const endNextDay = new Date(`${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T05:59:59.999${getArgentinaOffset()}`)
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(endNextDay.getTime())) {
            query.$or = [
                { createdAt: { $gte: start, $lte: end } },
                { createdAt: { $gte: new Date(`${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}T00:00:00.000${getArgentinaOffset()}`), $lte: endNextDay } }
            ]
        }
    }

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
        .sort({ createdAt: -1 })
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
    const { Pedido, Cliente, Caja, Producto } = req.models
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    // Sanitizar body: descartar campos internos y normalizar objetos poblados
    const body = { ...req.body }
    delete body._id
    delete body.__v
    delete body.createdAt
    delete body.updatedAt
    delete body.id
    if (body.mesaId === '') body.mesaId = null
    if (body.clienteId === '') body.clienteId = null
    if (body.mesaId && typeof body.mesaId === 'object') {
        body.mesaId = body.mesaId._id ? body.mesaId._id.toString() : null
    }
    if (body.clienteId && typeof body.clienteId === 'object') {
        body.clienteId = body.clienteId._id ? body.clienteId._id.toString() : null
    }

    const estadoAnterior = pedido.estado;
    const estadoNuevo = body.estado;

    // Snapshot de valores anteriores (antes de cualquier cambio)
    const prevE = parseFloat(pedido.efectivo) || 0
    const prevT = parseFloat(pedido.transferencia) || 0
    const prevTotal = parseFloat(pedido.total) || 0
    const prevClienteId = pedido.clienteId ? pedido.clienteId.toString() : null

    // Cuenta corriente: sincronizar saldo (antes de guardar para poder ajustar estado)
    if (estadoAnterior?.toLowerCase() !== 'cobrado') {
        const oldPaid = prevE + prevT
        const oldOutstanding = prevTotal - oldPaid

        const newTotal = body.total != null ? (parseFloat(body.total) || 0) : prevTotal
        const newE = body.efectivo != null ? (parseFloat(body.efectivo) || 0) : prevE
        const newT = body.transferencia != null ? (parseFloat(body.transferencia) || 0) : prevT
        const newPaid = newE + newT
        const newOutstanding = newTotal - newPaid

        const newClienteId = body.clienteId !== undefined
            ? (body.clienteId ? body.clienteId.toString() : null)
            : prevClienteId

        const adjustCliente = async (clienteId, delta) => {
            if (!clienteId || !delta) return
            const cliente = await Cliente.findById(clienteId)
            if (!cliente) return
            cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) + delta
            await cliente.save()
        }

        if (!prevClienteId && newClienteId) {
            await adjustCliente(newClienteId, newOutstanding)
            if (!body.estado) body.estado = 'Cuenta Corriente'
        } else if (prevClienteId && !newClienteId) {
            await adjustCliente(prevClienteId, -oldOutstanding)
        } else if (prevClienteId && newClienteId && prevClienteId !== newClienteId) {
            await adjustCliente(prevClienteId, -oldOutstanding)
            await adjustCliente(newClienteId, newOutstanding)
            if (!body.estado) body.estado = 'Cuenta Corriente'
        } else if (prevClienteId && newClienteId && prevClienteId === newClienteId) {
            const deltaTotal = newTotal - prevTotal
            const deltaPaid = newPaid - oldPaid
            await adjustCliente(prevClienteId, deltaTotal - deltaPaid)
        }
    }

    // Si cambió a "Cobrado", fijar cobradoAt
    const becameCobrado =
        body.estado?.toLowerCase() === 'cobrado' &&
        estadoAnterior?.toLowerCase() !== 'cobrado'

    if (becameCobrado && !pedido.cobradoAt) {
        body.cobradoAt = new Date()
    }

    // Guardar pedido
    Object.assign(pedido, body);
    await pedido.save();

    // Actualizar caja con delta de pagos
    const nextE = parseFloat(pedido.efectivo) || 0
    const nextT = parseFloat(pedido.transferencia) || 0
    const deltaE = nextE - prevE
    const deltaT = nextT - prevT

    if (deltaE !== 0 || deltaT !== 0) {
        const fechaPedido = formatDateYMD(pedido.createdAt)
        if (fechaPedido) {
            const caja = await Caja.findOne({ fecha: fechaPedido, cerrada: false }).sort({ createdAt: -1 })
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

    // Descontar cantidadDisponible al cobrar (compatible con todas las versiones de MongoDB)
    if (becameCobrado) {
        const items = Array.isArray(pedido.items) ? pedido.items : []
        for (const item of items) {
            if (!item.productoId) continue
            const cantidad = parseInt(item.cantidad) || 0
            if (cantidad <= 0) continue
            try {
                const prod = await Producto.findById(item.productoId)
                if (prod) {
                    const nueva = Math.max(0, (prod.cantidadDisponible || 0) - cantidad)
                    await Producto.updateOne({ _id: prod._id }, { $set: { cantidadDisponible: nueva } })
                }
            } catch (stockErr) {
                console.error(`Error descontando stock producto ${item.productoId}:`, stockErr)
            }
        }
    }

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