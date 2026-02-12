import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Obtener histórico completo (pedidos y turnos cobrados)
 * GET /api/historico
 */
export const getHistorico = asyncHandler(async (req, res) => {
    const { Pedido, Turno } = req.models
    try {
        const daysRaw = req.query?.days
        const days = Math.min(Math.max(parseInt(daysRaw ?? '45', 10) || 45, 1), 365)
        const desde = new Date()
        desde.setHours(0, 0, 0, 0)
        desde.setDate(desde.getDate() - days)

        // Obtener pedidos cobrados con información relacionada
        const pedidosCobrados = await Pedido.find({ estado: 'Cobrado', createdAt: { $gte: desde } })
            .populate('mesaId', 'numero nombre')
            .populate('clienteId', 'nombre')
            .sort({ createdAt: -1 });

    // Enriquecer pedidos con información adicional
    const historicoPedidos = pedidosCobrados.map((pedido) => {
        const pedidoObj = pedido.toObject();
        pedidoObj.tipo = 'pedido';
        // Asegurar que el id esté presente (puede ser _id en MongoDB)
        pedidoObj.id = pedidoObj._id || pedidoObj.id;

        // Agregar información de mesa
        // Priorizar mesaNombre del pedido (guardado cuando se creó el pedido)
        // Esto permite mostrar el nombre correcto incluso si la mesa ya no tiene nombre
        if (pedido.mesaId && typeof pedido.mesaId === 'object') {
            pedidoObj.mesaNumero = pedido.mesaId.numero;
            // Usar mesaNombre del pedido si existe, sino usar el nombre de la mesa
            pedidoObj.mesaNombre = pedido.mesaNombre || pedido.mesaId.nombre || null;
        } else {
            pedidoObj.mesaNombre = pedido.mesaNombre || null;
            pedidoObj.mesaNumero = null;
        }

        // Agregar información de cliente
        if (pedido.clienteId && typeof pedido.clienteId === 'object') {
            pedidoObj.clienteNombre = pedido.clienteId.nombre;
        } else {
            pedidoObj.clienteNombre = null;
        }

        return pedidoObj;
    });

    // Obtener turnos cobrados (incluyendo los que fueron eliminados de la sección Turnos)
    // porque en Histórico deben aparecer todos los cobrados
    const turnosCobrados = await Turno.find({ estado: 'Cobrado', createdAt: { $gte: desde } })
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

    // Enriquecer turnos con información adicional
    const historicoTurnos = turnosCobrados.map((turno) => {
        const turnoObj = turno.toObject();
        turnoObj.tipo = 'turno';
        // Asegurar que el id esté presente (puede ser _id en MongoDB)
        turnoObj.id = turnoObj._id || turnoObj.id;

        // Agregar información del pedido si existe
        if (turno.pedidoId && typeof turno.pedidoId === 'object') {
            const pedido = turno.pedidoId;
            turnoObj.pedidoInfo = {
                id: pedido._id || pedido.id,
                total: pedido.total,
                estado: pedido.estado
            };

            // Agregar información de mesa si el pedido tiene mesa
            // Priorizar mesaNombre del pedido (guardado cuando se creó el pedido)
            if (pedido.mesaId && typeof pedido.mesaId === 'object') {
                turnoObj.mesaNumero = pedido.mesaId.numero;
                // Usar mesaNombre del pedido si existe, sino usar el nombre de la mesa
                turnoObj.mesaNombre = pedido.mesaNombre || pedido.mesaId.nombre || null;
            } else {
                turnoObj.mesaNombre = null;
                turnoObj.mesaNumero = null;
            }

            // Agregar información de cliente si el pedido tiene cliente
            if (pedido.clienteId && typeof pedido.clienteId === 'object') {
                turnoObj.clienteNombre = pedido.clienteId.nombre;
            } else {
                turnoObj.clienteNombre = null;
            }
        } else {
            turnoObj.mesaNombre = null;
            turnoObj.mesaNumero = null;
            turnoObj.clienteNombre = null;
        }

        return turnoObj;
    });

    // Combinar pedidos y turnos
    const historicoCompleto = [...historicoPedidos, ...historicoTurnos];

        // Ordenar por fecha de creación (más recientes primero)
        historicoCompleto.sort((a, b) => {
            const fechaA = new Date(a.createdAt || a.created_at || 0);
            const fechaB = new Date(b.createdAt || b.created_at || 0);
            return fechaB - fechaA;
        });

        res.json(historicoCompleto);
    } catch (error) {
        console.error('Error en getHistorico:', error);
        throw error; // El asyncHandler se encargará de enviar la respuesta de error
    }
});

/**
 * Eliminar item del histórico
 * DELETE /api/historico/:id
 */
export const deleteItemHistorico = asyncHandler(async (req, res) => {
    const { Pedido, Turno } = req.models
    const { id } = req.params;

    // Buscar en pedidos
    const pedido = await Pedido.findById(id);
    if (pedido) {
        // Solo permitir eliminar pedidos cobrados
        if (pedido.estado?.toLowerCase() !== 'cobrado') {
            return res.status(400).json({
                error: 'Solo se pueden eliminar pedidos cobrados del histórico'
            });
        }
        await Pedido.findByIdAndDelete(id);
        return res.json({ success: true });
    }

    // Buscar en turnos
    const turno = await Turno.findById(id);
    if (turno) {
        // Solo permitir eliminar turnos cobrados
        if (turno.estado?.toLowerCase() !== 'cobrado') {
            return res.status(400).json({
                error: 'Solo se pueden eliminar turnos cobrados del histórico'
            });
        }
        await Turno.findByIdAndDelete(id);
        return res.json({ success: true });
    }

    return res.status(404).json({ error: 'Item no encontrado' });
});