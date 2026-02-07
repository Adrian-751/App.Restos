import { useEffect, useState } from "react";
import api from '../utils/api'

const Metricas = () => {
    const [metricas, setMetricas] = useState(null)
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('resumen') // 'resumen' | 'egresos'

    const fetchMetricas = async () => {
        try {
            const [semana, mes] = await Promise.all([
                api.get('/metricas/semana'),
                api.get('/metricas/mes')
            ])
            setMetricas({
                semana: semana.data,
                mes: mes.data
            })
            setLoading(false)
        } catch (error) {
            console.error('Error fetching metricas:', error)
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchMetricas()
        // Escuchar eventos de actualización de caja para actualizar métricas automáticamente
        const handleCajaUpdate = () => {
            fetchMetricas()
        }
        window.addEventListener('caja-updated', handleCajaUpdate)

        return () => {
            window.removeEventListener('caja-updated', handleCajaUpdate)
        }
    }, [])

    const metricasSemana = metricas?.semana
    const metricasMes = metricas?.mes

    const formatearMes = (fecha) => {
        const mesFormateado = new Date(fecha).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return mesFormateado.charAt(0).toUpperCase() + mesFormateado.slice(1);
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Métricas</h2>
                <div className="card text-center py-12">
                    <p className="text-slate-400">Cargando métricas...</p>
                </div>
            </div>
        )
    }


    return (
        <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Métricas</h2>

            <div className="flex flex-col sm:flex-row gap-2">
                <button
                    type="button"
                    onClick={() => setTab('resumen')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'resumen'
                        ? 'bg-fuxia-primary text-white'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                >
                    Resumen
                </button>
                <button
                    type="button"
                    onClick={() => setTab('egresos')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'egresos'
                        ? 'bg-fuxia-primary text-white'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                >
                    Total Egresos
                </button>
            </div>

            {!metricasSemana && !metricasMes && !loading && (
                <div className="card">
                    <p className="text-white">No hay datos disponibles. Asegúrate de tener pedidos cobrados y cajas registradas.</p>
                </div>
            )}

            {/* Pestaña: Total Egresos */}
            {tab === 'egresos' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="card">
                        <h3 className="text-xl font-bold text-white mb-2">Egresos Semanales</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            Del {new Date(metricasSemana?.inicioSemana).toLocaleDateString()} al {new Date(metricasSemana?.finSemana).toLocaleDateString()}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Efectivo</p>
                                <p className="text-2xl font-bold text-white">
                                    ${Number(metricasSemana?.egresos?.efectivo || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Transferencia</p>
                                <p className="text-2xl font-bold text-white">
                                    ${Number(metricasSemana?.egresos?.transferencia || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Total</p>
                                <p className="text-2xl font-bold text-red-300">
                                    ${Number(metricasSemana?.egresos?.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <h3 className="text-xl font-bold text-white mb-2">Egresos Mensuales</h3>
                        <p className="text-slate-400 text-sm mb-4">
                            {metricasMes?.inicioMes ? formatearMes(metricasMes.inicioMes) : ''}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Efectivo</p>
                                <p className="text-2xl font-bold text-white">
                                    ${Number(metricasMes?.egresos?.efectivo || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Transferencia</p>
                                <p className="text-2xl font-bold text-white">
                                    ${Number(metricasMes?.egresos?.transferencia || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-300 text-sm">Total</p>
                                <p className="text-2xl font-bold text-red-300">
                                    ${Number(metricasMes?.egresos?.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Métricas Semanales */}
            {tab === 'resumen' && metricasSemana && (
                <div className="card">
                    <h3 className="text-xl font-bold text-white mb-4">
                        Métricas Semanales
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        Del {new Date(metricasSemana.inicioSemana).toLocaleDateString()} al {new Date(metricasSemana.finSemana).toLocaleDateString()}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Efectivo</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasSemana.totalEfectivo || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Transferencias</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasSemana.totalTransferencia || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Turnos</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasSemana.turnos?.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            {(metricasSemana.turnos?.cantidad || 0) > 0 && (
                                <p className="text-xs text-slate-300 mt-1">
                                    x{Number(metricasSemana.turnos?.cantidad || 0).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total General</p>
                            <p className="text-2xl font-bold text-green-400">
                                ${Number(metricasSemana.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Pedidos Cobrados</p>
                            <p className="text-2xl font-bold text-white">
                                {Number(metricasSemana.cantidadPedidos || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Métricas Mensuales */}
            {tab === 'resumen' && metricasMes && (
                <div className="card">
                    <h3 className="text-xl font-bold text-white mb-4">
                        Métricas Mensuales
                    </h3>
                    <p className="text-slate-400 text-sm mb-4">
                        {formatearMes(metricasMes.inicioMes)}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Efectivo</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasMes.totalEfectivo || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Transferencias</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasMes.totalTransferencia || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total Turnos</p>
                            <p className="text-2xl font-bold text-white">
                                ${Number(metricasMes.turnos?.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                            {(metricasMes.turnos?.cantidad || 0) > 0 && (
                                <p className="text-xs text-slate-300 mt-1">
                                    x{Number(metricasMes.turnos?.cantidad || 0).toLocaleString()}
                                </p>
                            )}
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Total General</p>
                            <p className="text-2xl font-bold text-green-400">
                                ${Number(metricasMes.total || 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-300 text-sm">Pedidos Cobrados</p>
                            <p className="text-2xl font-bold text-white">
                                {Number(metricasMes.cantidadPedidos || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <button
                onClick={fetchMetricas}
                className="btn-primary w-full sm:w-auto"
            >
                Actualizar Métricas
            </button>
        </div>
    )
}

export default Metricas