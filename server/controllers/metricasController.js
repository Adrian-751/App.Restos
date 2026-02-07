import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener métricas de la semana
* GET /api/metricas/semana
*/
export const getMetricasSemana = asyncHandler(async (req, res) => {
    const { Caja, Pedido, Turno } = req.models
    // Calcular fecha de inicio de semana (lunes)
    const hoy = new Date();
    const diaSemana = hoy.getDay(); // 0 = domingo, 1 = lunes, etc.
    const diasDesdeLunes = diaSemana === 0 ? 6 : diaSemana - 1;

    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - diasDesdeLunes);
    inicioSemana.setHours(0, 0, 0, 0);

    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    finSemana.setHours(23, 59, 59, 999);

    // Filtrar cajas de esta semana
    const cajasSemana = await Caja.find({
        fecha: {
            $gte: inicioSemana.toISOString().split('T')[0],
            $lte: finSemana.toISOString().split('T')[0]
        }
    });

    // Filtrar pedidos cobrados de esta semana
    const pedidosSemana = await Pedido.find({
        estado: 'Cobrado',
        createdAt: {
            $gte: inicioSemana,
            $lte: finSemana
        }
    });

    const totalEfectivoBruto = cajasSemana.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferenciaBruto = cajasSemana.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosSemana.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosSemana.length;

    // Egresos dentro del rango (vienen guardados en Caja)
    const egresos = cajasSemana.reduce(
        (acc, c) => {
            const arr = Array.isArray(c.egresos) ? c.egresos : []
            for (const e of arr) {
                acc.efectivo += Number(e?.efectivo || 0)
                acc.transferencia += Number(e?.transferencia || 0)
            }
            return acc
        },
        { efectivo: 0, transferencia: 0 }
    )

    const totalEfectivo = totalEfectivoBruto - egresos.efectivo
    const totalTransferencia = totalTransferenciaBruto - egresos.transferencia
    const totalEgresos = egresos.efectivo + egresos.transferencia

    // Turnos cobrados (Turno model) + Turno Futbol vendido como item de pedido
    const turnosSemana = await Turno.find({
        estado: 'Cobrado',
        createdAt: { $gte: inicioSemana, $lte: finSemana }
    })

    const turnosModel = {
        cantidad: turnosSemana.length,
        total: turnosSemana.reduce((sum, t) => sum + (Number(t.total) || 0), 0),
    }

    const TURNO_PRODUCTO_NOMBRE = 'turno futbol'
    const turnosProducto = pedidosSemana.reduce(
        (acc, p) => {
            const items = Array.isArray(p.items) ? p.items : []
            for (const it of items) {
                const nombre = String(it?.nombre || '').trim().toLowerCase()
                if (nombre !== TURNO_PRODUCTO_NOMBRE) continue
                const cantidad = Number(it?.cantidad || 0)
                const subtotal = Number(it?.subtotal ?? ((Number(it?.precio || 0) * cantidad) || 0))
                acc.cantidad += cantidad
                acc.total += subtotal
            }
            return acc
        },
        { cantidad: 0, total: 0 }
    )

    const turnos = {
        cantidad: turnosModel.cantidad + turnosProducto.cantidad,
        total: turnosModel.total + turnosProducto.total,
    }

    res.json({
        inicioSemana: inicioSemana.toISOString().split('T')[0],
        finSemana: finSemana.toISOString().split('T')[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        egresos: { ...egresos, total: totalEgresos },
        turnos,
        cantidadPedidos,
        cantidadCajas: cajasSemana.length
    });
});

/**
 * Obtener métricas del mes
 * GET /api/metricas/mes
 */
export const getMetricasMes = asyncHandler(async (req, res) => {
    const { Caja, Pedido, Turno } = req.models
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    inicioMes.setHours(0, 0, 0, 0);

    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    finMes.setHours(23, 59, 59, 999);

    // Filtrar cajas de este mes
    const cajasMes = await Caja.find({
        fecha: {
            $gte: inicioMes.toISOString().split('T')[0],
            $lte: finMes.toISOString().split('T')[0]
        }
    });

    // Filtrar pedidos cobrados de este mes
    const pedidosMes = await Pedido.find({
        estado: 'Cobrado',
        createdAt: {
            $gte: inicioMes,
            $lte: finMes
        }
    });

    const totalEfectivoBruto = cajasMes.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferenciaBruto = cajasMes.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosMes.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosMes.length;

    const egresos = cajasMes.reduce(
        (acc, c) => {
            const arr = Array.isArray(c.egresos) ? c.egresos : []
            for (const e of arr) {
                acc.efectivo += Number(e?.efectivo || 0)
                acc.transferencia += Number(e?.transferencia || 0)
            }
            return acc
        },
        { efectivo: 0, transferencia: 0 }
    )

    const totalEfectivo = totalEfectivoBruto - egresos.efectivo
    const totalTransferencia = totalTransferenciaBruto - egresos.transferencia
    const totalEgresos = egresos.efectivo + egresos.transferencia

    const turnosMes = await Turno.find({
        estado: 'Cobrado',
        createdAt: { $gte: inicioMes, $lte: finMes }
    })

    const turnosModel = {
        cantidad: turnosMes.length,
        total: turnosMes.reduce((sum, t) => sum + (Number(t.total) || 0), 0),
    }

    const TURNO_PRODUCTO_NOMBRE = 'turno futbol'
    const turnosProducto = pedidosMes.reduce(
        (acc, p) => {
            const items = Array.isArray(p.items) ? p.items : []
            for (const it of items) {
                const nombre = String(it?.nombre || '').trim().toLowerCase()
                if (nombre !== TURNO_PRODUCTO_NOMBRE) continue
                const cantidad = Number(it?.cantidad || 0)
                const subtotal = Number(it?.subtotal ?? ((Number(it?.precio || 0) * cantidad) || 0))
                acc.cantidad += cantidad
                acc.total += subtotal
            }
            return acc
        },
        { cantidad: 0, total: 0 }
    )

    const turnos = {
        cantidad: turnosModel.cantidad + turnosProducto.cantidad,
        total: turnosModel.total + turnosProducto.total,
    }

    res.json({
        mes: hoy.getMonth() + 1,
        año: hoy.getFullYear(),
        inicioMes: inicioMes.toISOString().split('T')[0],
        finMes: finMes.toISOString().split('T')[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        egresos: { ...egresos, total: totalEgresos },
        turnos,
        cantidadPedidos,
        cantidadCajas: cajasMes.length
    });
});