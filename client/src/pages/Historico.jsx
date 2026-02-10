import { useEffect, useState } from 'react'
import api from '../utils/api'
import { toastError, toastSuccess } from '../utils/toast'
import Modal from '../components/Modal'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { useModalHotkeys } from '../hooks/useModalHotkeys'

const Historico = () => {
    const [historico, setHistorico] = useState([])
    const [cajas, setCajas] = useState([])
    const [loading, setLoading] = useState(true)
    const [tab, setTab] = useState('pedidos') // 'pedidos' | 'cajas'
    const [showEditModal, setShowEditModal] = useState(false)
    const [itemEditando, setItemEditando] = useState(null)
    const [observacionesEdit, setObservacionesEdit] = useState('')

    useLockBodyScroll(!!showEditModal)

    const fetchHistorico = async () => {
        try {
            const [historicoRes, cajasRes] = await Promise.all([
                api.get('/historico?days=30').catch(() => ({ data: [] })),
                api.get('/caja/todas?cerradas=true').catch(() => ({ data: [] }))
            ])
            setHistorico(historicoRes.data || [])
            setCajas(cajasRes.data || [])
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

    const openEdit = (item) => {
        setItemEditando(item)
        setObservacionesEdit(item?.observaciones || '')
        setShowEditModal(true)
    }

    const saveEdit = async () => {
        if (!itemEditando?._id) return
        try {
            await api.put(`/pedidos/${itemEditando._id}`, {
                observaciones: observacionesEdit || '',
            })
            setShowEditModal(false)
            setItemEditando(null)
            setObservacionesEdit('')
            fetchHistorico()
            toastSuccess('Pedido actualizado')
        } catch (error) {
            const msg = error.response?.data?.error || error.message || 'Error al actualizar el pedido'
            toastError(msg)
        }
    }

    useModalHotkeys({
        isOpen: showEditModal,
        onCancel: () => { setShowEditModal(false); setItemEditando(null) },
        onConfirm: saveEdit,
    })

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
        } else if (item.nombre) {
            return item.nombre
        } else {
            const id = item?._id || item?.id || ''
            return id ? `Pedido #${String(id).slice(-6)}` : 'Pedido'
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


    const calcularResumenCaja = (caja) => {
        const egresosArray = Array.isArray(caja.egresos) ? caja.egresos : []
        const egresosTotal = egresosArray.reduce(
            (acc, e) => {
                acc.efectivo += Number(e?.efectivo || 0)
                acc.transferencia += Number(e?.transferencia || 0)
                return acc
            },
            { efectivo: 0, transferencia: 0 }
        )
        egresosTotal.total = (egresosTotal.efectivo || 0) + (egresosTotal.transferencia || 0)

        return {
            fecha: caja.fecha,
            montoInicial: caja.montoInicial || 0,
            efectivo: caja.totalEfectivo || 0,
            transferencia: caja.totalTransferencia || 0,
            egresos: egresosTotal,
            total: (caja.montoInicial || 0) + (caja.totalEfectivo || 0) + (caja.totalTransferencia || 0),
            cerradaAt: caja.cerradaAt || caja.updatedAt
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Histórico</h2>
                <div className="text-sm text-slate-400 sm:text-right">
                    {tab === 'pedidos'
                        ? `${historico.length} pedido${historico.length !== 1 ? 's' : ''} cobrado${historico.length !== 1 ? 's' : ''}`
                        : `${cajas.length} caja${cajas.length !== 1 ? 's' : ''} cerrada${cajas.length !== 1 ? 's' : ''}`
                    }
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
                <button
                    type="button"
                    onClick={() => setTab('pedidos')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'pedidos'
                        ? 'bg-fuxia-primary text-white'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                >
                    Histórico de Pedidos
                </button>
                <button
                    type="button"
                    onClick={() => setTab('cajas')}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'cajas'
                        ? 'bg-fuxia-primary text-white'
                        : 'bg-white/10 text-slate-200 hover:bg-white/15'
                        }`}
                >
                    Histórico de Cajas
                </button>
            </div>

            {tab === 'cajas' && (
                <>
                    {cajas.length === 0 ? (
                        <div className="card text-center py-12">
                            <p className="text-slate-400 text-lg">No hay cajas cerradas</p>
                            <p className="text-slate-500 text-sm mt-2">Las cajas aparecerán aquí una vez que estén cerradas</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {cajas.map((caja) => {
                                const resumen = calcularResumenCaja(caja)
                                return (
                                    <div key={caja._id} className="card">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex-1">
                                                <h3 className="text-lg font-bold text-white">
                                                    Caja - {resumen.fecha}
                                                </h3>
                                                <p className="text-sm text-slate-400">
                                                    {formatFecha(resumen.cerradaAt)}
                                                </p>
                                            </div>
                                            <span className="px-2 py-1 rounded text-xs bg-slate-600 text-white whitespace-nowrap ml-2">
                                                Cerrada
                                            </span>
                                        </div>

                                        <div className="space-y-3 mb-4">
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Monto Inicial:</span>
                                                <span className="text-white font-semibold">
                                                    ${resumen.montoInicial.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Efectivo:</span>
                                                <span className="text-green-400 font-semibold">
                                                    ${resumen.efectivo.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span className="text-slate-400">Transferencia:</span>
                                                <span className="text-blue-400 font-semibold">
                                                    ${resumen.transferencia.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="border-t border-slate-700 pt-2">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-slate-400">Egresos:</span>
                                                    <span className="text-red-400 font-semibold">
                                                        ${resumen.egresos.total.toLocaleString()}
                                                    </span>
                                                </div>
                                                {resumen.egresos.total > 0 && (
                                                    <div className="text-xs text-slate-500 pl-2">
                                                        Ef: ${resumen.egresos.efectivo.toLocaleString()} / Tr: ${resumen.egresos.transferencia.toLocaleString()}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-700 pt-4">
                                            <div className="flex justify-between text-lg font-bold text-white">
                                                <span>Total:</span>
                                                <span>${resumen.total.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === 'pedidos' && (
                <>
                    {historico.length === 0 ? (
                        <div className="card text-center py-12">
                            <p className="text-slate-400 text-lg">No hay pedidos en el histórico</p>
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
                                        {item.tipo === 'pedido' && (
                                            <button
                                                onClick={() => openEdit(item)}
                                                className="w-full bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg text-sm transition-colors mb-2"
                                            >
                                                Editar observaciones
                                            </button>
                                        )}
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
                </>
            )}

            <Modal
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setItemEditando(null) }}
                title={`Editar pedido: ${itemEditando ? getNombreItem(itemEditando) : ''}`}
                maxWidth="max-w-lg"
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Observaciones
                        </label>
                        <textarea
                            value={observacionesEdit}
                            onChange={(e) => setObservacionesEdit(e.target.value)}
                            className="input-field"
                            rows="4"
                            placeholder="Ej: Transferencia a nombre de..., comprobante..., etc."
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={saveEdit} className="btn-primary w-full sm:flex-1">
                            Guardar
                        </button>
                        <button
                            onClick={() => { setShowEditModal(false); setItemEditando(null) }}
                            className="btn-secondary w-full sm:flex-1"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default Historico

