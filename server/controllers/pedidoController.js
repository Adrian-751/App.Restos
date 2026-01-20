import Pedido from '../models/Pedido.js';
import Cliente from '../models/Cliente.js';
import Caja from '../models/Caja.js';
import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener todos los pedidos
 * GET /api/pedidos
 */
export const getPedidos = asyncHandler(async (req, res) => {
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
    const { mesaId, clienteId, items, total, observaciones } = req.body;

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

    const pedido = await Pedido.create({
        mesaId: mesaId || null,
        clienteId: clienteId || null,
        items: items || [],
        total: total || 0,
        efectivo: 0,
        transferencia: 0,
        observaciones: observaciones || '',
        estado
    });

    res.status(201).json(pedido);
});


/* Actualizar pedido
 * PUT /api/pedidos/:id
 */
export const updatePedido = asyncHandler(async (req, res) => {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const estadoAnterior = pedido.estado;
    const estadoNuevo = req.body.estado;

    // Si cambió a "Cobrado"
    if (estadoNuevo?.toLowerCase() === 'cobrado' &&
        estadoAnterior?.toLowerCase() !== 'cobrado') {

        // Actualizar caja
        const hoy = new Date().toISOString().split('T')[0];
        const caja = await Caja.findOne({ fecha: hoy, cerrada: false });

        if (caja) {
            const efectivo = parseFloat(req.body.efectivo) || 0;
            const transferencia = parseFloat(req.body.transferencia) || 0;

            caja.totalEfectivo = (caja.totalEfectivo || 0) + efectivo;
            caja.totalTransferencia = (caja.totalTransferencia || 0) + transferencia;

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

        // Si es cuenta corriente, restar de la cuenta del cliente
        if (pedido.clienteId) {
            const cliente = await Cliente.findById(pedido.clienteId);
            if (cliente) {
                cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) - (pedido.total || 0);
                await cliente.save();
            }
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
    const pedido = await Pedido.findByIdAndDelete(req.params.id);

    if (!pedido) {
        return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ success: true });
});