import { useEffect, useState } from 'react'
import api from '../utils/api'

const Panel = () => {
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)

    const fetchStats = async () => {
        try {
            const [caja, mesas, pedidos, cajasHoy, turnos] = await Promise.all([
                api.get('/caja/estado').catch(() => ({ data: null })),
                api.get('/mesas').catch(() => ({ data: [] })),
                api.get('/pedidos').catch(() => ({ data: [] })),
                api.get('/caja/resumen').catch(() => ({ data: [] })),
                api.get('/turnos').catch(() => ({ data: [] })),
            ])

            //Buscar la caja del dia (abierta o cerrada)
            const hoy = new Date().toISOString().split("T")[0];
            const cajasHoyArray = Array.isArray(cajasHoy.data) ? cajasHoy.data : []
            const cajaHoy = caja.data || cajasHoyArray.find(c => c.fecha === hoy);

            // Calcular el total del día (solo facturación)
            const totalDia = cajaHoy
                ? (cajaHoy.totalDia || (cajaHoy.totalEfectivo || 0) + (cajaHoy.totalTransferencia || 0))
                : 0;

            // Egresos del día (si existen)
            const egresosArray = Array.isArray(cajaHoy?.egresos) ? cajaHoy.egresos : []
            const egresosHoy = egresosArray.reduce(
                (acc, e) => {
                    acc.efectivo += Number(e?.efectivo || 0)
                    acc.transferencia += Number(e?.transferencia || 0)
                    return acc
                },
                { efectivo: 0, transferencia: 0 }
            )
            egresosHoy.total = (egresosHoy.efectivo || 0) + (egresosHoy.transferencia || 0)

            // Calcular turnos cobrados del día
            const turnosArray = Array.isArray(turnos.data) ? turnos.data : []
            const turnosHoy = turnosArray.filter((t) => {
                if (!t || !t.createdAt) return false
                const fechaTurno = new Date(t.createdAt).toISOString().split("T")[0];
                return fechaTurno === hoy && t.estado?.toLowerCase() === 'cobrado';
            });
            const cantidadTurnosDesdeTurnos = turnosHoy.length;
            const totalTurnosDesdeTurnos = turnosHoy.reduce((sum, t) => sum + (parseFloat(t.total) || 0), 0);

            // Si la caja está cerrada, calcular el monto total (monto inicial + total del día)
            let montoCajaCerrada = null;
            if (cajaHoy && cajaHoy.cerrada) {
                const montoInicial = cajaHoy.montoInicial || 0;
                montoCajaCerrada = montoInicial + totalDia;
            }

            const mesasArray = Array.isArray(mesas.data) ? mesas.data : []
            const pedidosArray = Array.isArray(pedidos.data) ? pedidos.data : []

            // También permitir contar "turnos" vendidos como producto desde Pedidos,
            // pero SOLO si el producto se llama "Turno Futbol".
            const TURNO_PRODUCTO_NOMBRE = 'turno futbol'
            const pedidosCobradosHoy = pedidosArray.filter((p) => {
                if (!p || !p.createdAt) return false
                const fechaPedido = new Date(p.createdAt).toISOString().split("T")[0]
                return fechaPedido === hoy && String(p.estado || '').toLowerCase() === 'cobrado'
            })

            const turnosDesdePedidos = pedidosCobradosHoy.reduce(
                (acc, p) => {
                    const items = Array.isArray(p.items) ? p.items : []
                    for (const it of items) {
                        const nombre = String(it?.nombre || '').trim().toLowerCase()
                        if (nombre !== TURNO_PRODUCTO_NOMBRE) continue
                        const cantidad = Number(it?.cantidad || 0)
                        const subtotal = Number(
                            it?.subtotal ?? ((Number(it?.precio || 0) * cantidad) || 0)
                        )
                        acc.cantidad += cantidad
                        acc.total += subtotal
                    }
                    return acc
                },
                { cantidad: 0, total: 0 }
            )

            const cantidadTurnos = cantidadTurnosDesdeTurnos + turnosDesdePedidos.cantidad
            const totalTurnos = totalTurnosDesdeTurnos + turnosDesdePedidos.total

            setStats({
                cajaAbierta: !!caja.data,
                mesasOcupadas: mesasArray.filter((m) => m.estado === 'ocupada').length,
                mesasReservadas: mesasArray.filter((m) => m.estado === 'reservada').length,
                pedidosPendientes: pedidosArray.filter((p) => p.estado === 'Pendiente').length,
                totalHoy: totalDia,
                montoCajaCerrada: montoCajaCerrada,
                turnosHoy: { cantidad: cantidadTurnos, total: totalTurnos },
                egresosHoy,
            })
            setLoading(false)
        } catch (error) {
            console.error('Error fetching stats:', error)
            // Inicializar con valores por defecto si hay error
            setStats({
                cajaAbierta: false,
                mesasOcupadas: 0,
                mesasReservadas: 0,
                pedidosPendientes: 0,
                totalHoy: 0,
                montoCajaCerrada: null,
                turnosHoy: { cantidad: 0, total: 0 },
                egresosHoy: { efectivo: 0, transferencia: 0, total: 0 },
            })
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchStats()
        const handleMesaUpdate = () => fetchStats()
        const handleCajaUpdate = () => fetchStats()
        const handleTurnoUpdate = () => fetchStats()

        window.addEventListener('mesa-updated', handleMesaUpdate)
        window.addEventListener('caja-updated', handleCajaUpdate)
        window.addEventListener('turno-updated', handleTurnoUpdate)

        return () => {
            window.removeEventListener('mesa-updated', handleMesaUpdate)
            window.removeEventListener('caja-updated', handleCajaUpdate)
            window.removeEventListener('turno-updated', handleTurnoUpdate)
        }
    }, [])

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Panel de Administración</h2>
                <div className="card text-center py-12">
                    <p className="text-slate-400">Cargando estadísticas...</p>
                </div>
            </div>
        )
    }

    if (!stats) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Panel de Administración</h2>
                <div className="card text-center py-12">
                    <p className="text-slate-400">No se pudieron cargar las estadísticas</p>
                    <button onClick={fetchStats} className="btn-primary mt-4">
                        Reintentar
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Panel de Administración</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                <div className="card bg-gradient-to-br from-orange-600 to-orange-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-200 text-sm">Estado de Caja</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                {stats.cajaAbierta ? 'Abierta' : 'Cerrada'}
                            </p>
                            {!stats.cajaAbierta && stats.montoCajaCerrada !== null && (
                                <p className="text-lg font-semibold text-orange-100 mt-1">
                                    ${stats.montoCajaCerrada.toLocaleString()}
                                </p>
                            )}
                        </div>
                        <span className="text-4xl">💰</span>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-red-600 to-red-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-blue-200 text-sm">Mesas Ocupadas</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats.mesasOcupadas}</p>
                        </div>
                        <span className="text-4xl">🍽️</span>
                    </div>
                </div>

                <div className="card bg-gradient-to-r from-fuxia-primary to-fuxia-dark">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-200 text-sm">Mesas Reservadas</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats.mesasReservadas}</p>
                        </div>
                        <span className="text-4xl">📅</span>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-blue-600 to-blue-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-green-200 text-sm">Pedidos Pendientes</p>
                            <p className="text-2xl font-bold text-white mt-1">{stats.pedidosPendientes}</p>
                        </div>
                        <span className="text-4xl">📝</span>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-slate-700 to-slate-900">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-200 text-sm">Egresos Hoy</p>
                            <p className="text-2xl font-bold text-white mt-1">
                                ${Number(stats.egresosHoy?.total || 0).toLocaleString()}
                            </p>
                            {(Number(stats.egresosHoy?.total || 0) > 0) && (
                                <p className="text-xs font-semibold text-slate-200 mt-1">
                                    Ef: ${Number(stats.egresosHoy?.efectivo || 0).toLocaleString()} / Tr: ${Number(stats.egresosHoy?.transferencia || 0).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <span className="text-4xl">↘️</span>
                    </div>
                </div>

                <div className="card bg-gradient-to-br from-green-600 to-green-800">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-purple-200 text-sm">Total Hoy</p>
                            {stats.turnosHoy.cantidad > 0 && (
                                <p className="text-sm font-semibold text-green-100 mt-1">
                                    Turnos: x{stats.turnosHoy.cantidad} = ${stats.turnosHoy.total.toLocaleString()}
                                </p>
                            )}
                            <p className="text-2xl font-bold text-white mt-1">
                                ${stats.totalHoy.toLocaleString()}
                            </p>
                        </div>
                        <span className="text-4xl">💵</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Panel


