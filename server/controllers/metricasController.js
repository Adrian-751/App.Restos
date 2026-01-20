import Caja from '../models/Caja.js';
import Pedido from '../models/Pedido.js';
import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener métricas de la semana
* GET /api/metricas/semana
*/
export const getMetricasSemana = asyncHandler(async (req, res) => {
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

    const totalEfectivo = cajasSemana.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferencia = cajasSemana.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosSemana.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosSemana.length;

    res.json({
        inicioSemana: inicioSemana.toISOString().split('T')[0],
        finSemana: finSemana.toISOString().split('T')[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        cantidadPedidos,
        cantidadCajas: cajasSemana.length
    });
});

/**
 * Obtener métricas del mes
 * GET /api/metricas/mes
 */
export const getMetricasMes = asyncHandler(async (req, res) => {
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

    const totalEfectivo = cajasMes.reduce((sum, c) => sum + (c.totalEfectivo || 0), 0);
    const totalTransferencia = cajasMes.reduce((sum, c) => sum + (c.totalTransferencia || 0), 0);
    const totalVentas = pedidosMes.reduce((sum, p) => sum + (p.total || 0), 0);
    const cantidadPedidos = pedidosMes.length;

    res.json({
        mes: hoy.getMonth() + 1,
        año: hoy.getFullYear(),
        inicioMes: inicioMes.toISOString().split('T')[0],
        finMes: finMes.toISOString().split('T')[0],
        totalEfectivo,
        totalTransferencia,
        totalVentas,
        total: totalEfectivo + totalTransferencia,
        cantidadPedidos,
        cantidadCajas: cajasMes.length
    });
});