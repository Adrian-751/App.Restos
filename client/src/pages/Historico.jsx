import { useEffect, useState } from 'react'
import api from '../utils/api'
import { toastError, toastSuccess } from '../utils/toast'

const Historico = () => {
    const [historico, setHistorico] = useState([])
    const [loading, setLoading] = useState(true)

    const fetchHistorico = async () => {
        try {
            const res = await api.get('/historico?days=45')
            setHistorico(res.data)
            setLoading(false)
        } catch (error) {
            console.error('Error fetching historico:', error)
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchHistorico()
        // Escuchar eventos de actualización para refrescar el histórico
        const handlePedidoUpdate = () => {
            fetchHistorico()
        }
        window.addEventListener('caja-updated', handlePedidoUpdate)
        window.addEventListener('pedido-cobrado', handlePedidoUpdate)
        window.addEventListener('turno-updated', handlePedidoUpdate)

        return () => {
            window.removeEventListener('caja-updated', handlePedidoUpdate)
            window.removeEventListener('pedido-cobrado', handlePedidoUpdate)
            window.removeEventListener('turno-updated', handlePedidoUpdate)
        }
    }, [])

    const deletePedido = async (id) => {
        if (!window.confirm('¿Eliminar este item del histórico?')) return
        try {
            await api.delete(`/historico/${id}`)
            fetchHistorico()
            toastSuccess('Item eliminado')
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al eliminar el item'
            toastError(`Error al eliminar el item: ${mensaje}`)
        }
    }

    const formatFecha = (fecha) => {
        return new Date(fecha).toLocaleString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getNombreItem = (item) => {
        if (item.tipo === 'turno') {
            return `Turno #${item.numero}${item.nombre ? ` - ${item.nombre}` : ''}`
        }

        // Es un pedido
        if (item.mesaNombre && item.mesaNumero) {
            return `Mesa ${item.mesaNumero} - ${item.mesaNombre}`
        } else if (item.mesaNumero) {
            return `Mesa ${item.mesaNumero}`
        } else if (item.clienteNombre) {
            return `Cliente: ${item.clienteNombre}`
        } else {
            return `Pedido #${item._id.slice(-6)}`
        }
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Histórico</h2>
                <div className="card text-center py-12">
                    <p className="text-slate-400">Cargando histórico...</p>
                </div>
            </div>
        )
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Histórico de Pedidos</h2>
                <div className="text-sm text-slate-400 sm:text-right">
                    {historico.length} item{historico.length !== 1 ? 's' : ''} cobrado{historico.length !== 1 ? 's' : ''}
                </div>
            </div>

            {historico.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-slate-400 text-lg">No hay items en el histórico</p>
                    <p className="text-slate-500 text-sm mt-2">Los pedidos y turnos aparecerán aquí una vez que estén completamente pagados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {historico.map((item) => (
                        <div key={item._id} className="card">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="text-lg font-bold text-white">
                                            {getNombreItem(item)}
                                        </h3>
                                        {item.tipo === 'turno' && (
                                            <span className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                                Turno
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-400">
                                        {formatFecha(item.createdAt)}
                                    </p>
                                </div>
                                <span className="px-2 py-1 rounded text-xs bg-green-600 text-white whitespace-nowrap ml-2">
                                    Cobrado
                                </span>
                            </div>

                            {/* Información de mesa */}
                            {item.mesaNumero && (
                                <div className="mb-3 pb-3 border-b border-slate-700">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Mesa:</span>
                                        <span className="text-white font-semibold">
                                            #{item.mesaNumero}
                                            {item.mesaNombre && ` - ${item.mesaNombre}`}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Información de cliente */}
                            {item.clienteNombre && (
                                <div className="mb-3 pb-3 border-b border-slate-700">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Cliente:</span>
                                        <span className="text-white font-semibold">
                                            {item.clienteNombre}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Productos (solo para pedidos) */}
                            {item.tipo === 'pedido' && item.items && item.items.length > 0 && (
                                <div className="space-y-2 mb-4">
                                    <p className="text-sm font-semibold text-slate-300 mb-2">Productos:</p>
                                    {item.items.map((prod, idx) => (
                                        <div key={idx} className="flex justify-between text-sm bg-slate-800 rounded px-3 py-2">
                                            <span className="text-slate-300">
                                                {prod.cantidad}x {prod.nombre}
                                            </span>
                                            <span className="text-white font-semibold">
                                                ${(prod.precio * prod.cantidad).toLocaleString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Forma de pago */}
                            <div className="border-t border-slate-700 pt-4 space-y-2 mb-4">
                                <p className="text-sm font-semibold text-slate-300 mb-2">Forma de pago:</p>
                                <div className="space-y-1">
                                    {item.efectivo > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Efectivo:</span>
                                            <span className="text-green-400 font-semibold">
                                                ${item.efectivo.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {item.transferencia > 0 && (
                                        <div className="flex justify-between text-sm">
                                            <span className="text-slate-400">Transferencia:</span>
                                            <span className="text-blue-400 font-semibold">
                                                ${item.transferencia.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Total */}
                            <div className="border-t border-slate-700 pt-4 mb-4">
                                <div className="flex justify-between text-lg font-bold text-white">
                                    <span>Total:</span>
                                    <span>${item.total?.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Observaciones si existen */}
                            {item.observaciones && (
                                <div className="mb-4 pb-4 border-b border-slate-700">
                                    <p className="text-xs text-slate-400 mb-1">Observaciones:</p>
                                    <p className="text-sm text-slate-300">{item.observaciones}</p>
                                </div>
                            )}

                            {/* Botón Eliminar */}
                            <div className="mt-4">
                                <button
                                    onClick={() => deletePedido(item._id)}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default Historico

