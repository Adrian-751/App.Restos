import { asyncHandler } from '../middleware/errorHandler.js';
import { getTodayYMD } from '../utils/date.js'


/* Obtener todos los pedidos
 * GET /api/pedidos
 */
export const getPedidos = asyncHandler(async (req, res) => {
    const { Pedido } = req.models
    const pedidos = await Pedido.find()
        .populate('mesaId', 'numero nombre')
        .populate('clienteId', 'nombre')
        .sort({ createdAt: -1 });

    res.json(pedidos);
});


/* Crear nuevo pedido
 * POST /api/pedidos
 */
export const createPedido = asyncHandler(async (req, res) => {
    const { Pedido, Cliente, Mesa } = req.models
    const { nombre, mesaId, clienteId, items, total, observaciones, fecha } = req.body;

    // Determinar estado inicial
    let estado = 'Pendiente';
    if (clienteId) {
        estado = 'Cuenta Corriente';

        // Actualizar cuenta corriente del cliente
        const cliente = await Cliente.findById(clienteId);
        if (cliente) {
            cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) + (total || 0);
            await cliente.save();
        }
    }

    // Obtener el nombre de la mesa si hay mesaId
    let mesaNombre = ''
    if (mesaId) {
        const mesa = await Mesa.findById(mesaId)
        if (mesa) {
            mesaNombre = mesa.nombre || ''
        }
    }

    // Si se proporciona una fecha, convertirla a Date para createdAt
    let createdAt = undefined
    if (fecha) {
        // La fecha viene en formato YYYY-MM-DD, convertir a Date
        const fechaDate = new Date(fecha + 'T12:00:00') // Usar mediodía para evitar problemas de timezone
        if (!isNaN(fechaDate.getTime())) {
            createdAt = fechaDate
        }
    }

    const pedidoData = {
        nombre: (nombre ?? '').toString(),
        mesaId: mesaId || null,
        mesaNombre: mesaNombre,
        clienteId: clienteId || null,
        items: items || [],
        total: total || 0,
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
    const { Pedido, Cliente, Caja, Mesa } = req.models
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoAnterior = pedido.estado;
    const estadoNuevo = req.body.estado;

    // Sanitizar IDs (evita CastError cuando viene "" desde selects)
    if (req.body.mesaId === '') req.body.mesaId = null
    if (req.body.clienteId === '') req.body.clienteId = null

    // Actualizar el nombre de la mesa si se cambia la mesa o si se actualiza el pedido
    if (req.body.mesaId !== undefined) {
        const nuevaMesaId = req.body.mesaId || null
        if (nuevaMesaId) {
            const mesa = await Mesa.findById(nuevaMesaId)
            if (mesa) {
                req.body.mesaNombre = mesa.nombre || ''
            } else {
                req.body.mesaNombre = ''
            }
        } else {
            req.body.mesaNombre = ''
        }
    }

    // 1) Caja: sumar pagos parciales (delta efectivo/transferencia) aunque NO esté Cobrado
    // Esto permite que Caja/Gestión/Métricas reflejen ingresos en tiempo real.
    {
        const prevE = parseFloat(pedido.efectivo) || 0
        const prevT = parseFloat(pedido.transferencia) || 0
        const prevTotal = parseFloat(pedido.total) || 0
        const nextE = req.body.efectivo != null ? (parseFloat(req.body.efectivo) || 0) : prevE
        const nextT = req.body.transferencia != null ? (parseFloat(req.body.transferencia) || 0) : prevT
        const nextTotal = req.body.total != null ? (parseFloat(req.body.total) || 0) : prevTotal
        const deltaE = nextE - prevE
        const deltaT = nextT - prevT

        // Si el total cambió y hay pagos parciales, ajustar los pagos si exceden el nuevo total
        let ajusteE = deltaE
        let ajusteT = deltaT
        if (nextTotal !== prevTotal && (nextE > 0 || nextT > 0)) {
            const totalPagado = nextE + nextT
            if (totalPagado > nextTotal) {
                // Los pagos exceden el nuevo total, ajustar proporcionalmente
                const ratio = nextTotal / totalPagado
                const nuevoE = nextE * ratio
                const nuevoT = nextT * ratio
                ajusteE = nuevoE - prevE
                ajusteT = nuevoT - prevT
                // Actualizar los valores en req.body para que se guarden correctamente
                req.body.efectivo = nuevoE
                req.body.transferencia = nuevoT
            }
        }

        if (ajusteE !== 0 || ajusteT !== 0) {
            // Buscar la caja correcta según el rango de tiempo (desde createdAt hasta cerradaAt o ahora)
            const fechaPedido = pedido.createdAt ? new Date(pedido.createdAt) : null
            let caja = null
            if (fechaPedido) {
                // Buscar todas las cajas abiertas y encontrar la que contiene esta fecha en su rango
                const cajasAbiertas = await Caja.find({ cerrada: false }).sort({ createdAt: -1 })
                const ahora = new Date()
                for (const c of cajasAbiertas) {
                    const inicioCaja = c.createdAt ? new Date(c.createdAt) : new Date(c.fecha + 'T00:00:00')
                    const finCaja = c.cerradaAt ? new Date(c.cerradaAt) : ahora
                    if (fechaPedido >= inicioCaja && fechaPedido <= finCaja) {
                        caja = c
                        break
                    }
                }
            }
            // Solo registrar si encontramos la caja correcta
            if (caja) {
                caja.totalEfectivo = (caja.totalEfectivo || 0) + ajusteE
                caja.totalTransferencia = (caja.totalTransferencia || 0) + ajusteT
                if (caja.totalEfectivo < 0) caja.totalEfectivo = 0
                if (caja.totalTransferencia < 0) caja.totalTransferencia = 0

                if (!caja.ventas) caja.ventas = []
                caja.ventas.push({
                    pedidoId: pedido._id.toString(),
                    tipo: 'pedido',
                    total: (ajusteE + ajusteT),
                    efectivo: ajusteE,
                    transferencia: ajusteT,
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
        if (estadoNuevo?.toLowerCase() === 'cobrado' &&
            estadoAnterior?.toLowerCase() !== 'cobrado') {

        // Buscar la caja correcta según el rango de tiempo (desde createdAt hasta cerradaAt o ahora)
        const fechaPedido = pedido.createdAt ? new Date(pedido.createdAt) : null
        let caja = null
        if (fechaPedido) {
            // Buscar todas las cajas abiertas y encontrar la que contiene esta fecha en su rango
            const cajasAbiertas = await Caja.find({ cerrada: false }).sort({ createdAt: -1 })
            const ahora = new Date()
            for (const c of cajasAbiertas) {
                const inicioCaja = c.createdAt ? new Date(c.createdAt) : new Date(c.fecha + 'T00:00:00')
                const finCaja = c.cerradaAt ? new Date(c.cerradaAt) : ahora
                if (fechaPedido >= inicioCaja && fechaPedido <= finCaja) {
                    caja = c
                    break
                }
            }
        }
        // Solo registrar si encontramos la caja correcta
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
    const { Pedido } = req.models
    const pedido = await Pedido.findByIdAndDelete(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ success: true });
});