import { useState, useEffect } from 'react'
import api from '../utils/api'

const Turnos = () => {
    const [turnos, setTurnos] = useState([])
    const [pedidos, setPedidos] = useState([])
    const [mesas, setMesas] = useState([])
    const [clientes, setClientes] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingTurno, setEditingTurno] = useState(null)
    const [formData, setFormData] = useState({
        nombre: '',
        asignacionTipo: '', // 'mesa', 'cliente', o ''
        asignacionId: '', // ID de la mesa o cliente seleccionada
        pedidoId: '',
        total: '',
        efectivo: 0,
        transferencia: 0,
        observaciones: '',
    })
    const [showCobroModal, setShowCobroModal] = useState(false)
    const [turnoACobrar, setTurnoACobrar] = useState(null)
    const [cobroData, setCobroData] = useState({
        efectivo: 0,
        transferencia: 0,
        observaciones: '',
    })

    useEffect(() => {
        fetchTurnos()
        fetchPedidos()
        fetchMesas()
        fetchClientes()
        
        // Escuchar eventos de actualización
        const handleUpdate = () => {
            fetchTurnos()
        }
        window.addEventListener('caja-updated', handleUpdate)
        window.addEventListener('turno-updated', handleUpdate)

        return () => {
            window.removeEventListener('caja-updated', handleUpdate)
            window.removeEventListener('turno-updated', handleUpdate)
        }
    }, [])

    const fetchTurnos = async () => {
        try {
            const res = await api.get('/turnos')
            setTurnos(res.data)
        } catch (error) {
            console.error('Error fetching turnos:', error)
        }
    }

    const fetchPedidos = async () => {
        try {
            const res = await api.get('/pedidos')
            const pedidosFiltrados = res.data.filter(p => p.estado?.toLowerCase() !== 'cobrado')
            setPedidos(pedidosFiltrados)
        } catch (error) {
            console.error('Error fetching pedidos:', error)
        }
    }

    const fetchMesas = async () => {
        try {
            const res = await api.get('/mesas')
            setMesas(res.data)
        } catch (error) {
            console.error('Error fetching mesas:', error)
        }
    }

    const fetchClientes = async () => {
        try {
            const res = await api.get('/clientes')
            setClientes(res.data)
        } catch (error) {
            console.error('Error fetching clientes:', error)
        }
    }

    const openEditModal = (turno = null) => {
        if (turno) {
            // Si tiene mesaId, establecer asignación a mesa
            // Si tiene clienteId, establecer asignación a cliente
            // Si solo tiene pedidoId, mantenerlo como está
            let asignacionTipo = ''
            let asignacionId = ''
            
            if (turno.mesaId) {
                asignacionTipo = 'mesa'
                asignacionId = typeof turno.mesaId === 'object' ? turno.mesaId._id : turno.mesaId
            } else if (turno.clienteId) {
                asignacionTipo = 'cliente'
                asignacionId = typeof turno.clienteId === 'object' ? turno.clienteId._id : turno.clienteId
            }
            
            setFormData({
                nombre: turno.nombre || '',
                asignacionTipo: asignacionTipo,
                asignacionId: asignacionId,
                pedidoId: turno.pedidoId || '',
                total: turno.total || '',
                efectivo: turno.efectivo || 0,
                transferencia: turno.transferencia || 0,
                observaciones: turno.observaciones || '',
            })
        } else {
            setFormData({
                nombre: '',
                asignacionTipo: '',
                asignacionId: '',
                pedidoId: '',
                total: '',
                efectivo: 0,
                transferencia: 0,
                observaciones: '',
            })
        }
        setEditingTurno(turno)
        setShowModal(true)
    }

    const saveTurno = async () => {
        try {
            const total = parseFloat(formData.total) || 0
            
            const data = {
                nombre: formData.nombre,
                total: total,
                efectivo: parseFloat(formData.efectivo) || 0,
                transferencia: parseFloat(formData.transferencia) || 0,
                observaciones: formData.observaciones || '',
            }
            
            // Si hay asignación (mesa o cliente), usar esa
            if (formData.asignacionTipo === 'mesa' && formData.asignacionId) {
                data.mesaId = formData.asignacionId
                data.clienteId = null
                data.pedidoId = null
            } else if (formData.asignacionTipo === 'cliente' && formData.asignacionId) {
                data.clienteId = formData.asignacionId
                data.mesaId = null
                data.pedidoId = null
            } else if (formData.pedidoId) {
                // Si hay pedidoId, mantener compatibilidad
                data.pedidoId = formData.pedidoId
                data.mesaId = null
                data.clienteId = null
            } else {
                data.pedidoId = null
                data.mesaId = null
                data.clienteId = null
            }

            if (editingTurno) {
                await api.put(`/turnos/${editingTurno._id}`, data)
            } else {
                await api.post('/turnos', data)
            }
            
            setShowModal(false)
            setEditingTurno(null)
            fetchTurnos()
            window.dispatchEvent(new Event('turno-updated'))
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al guardar el turno'
            alert(errorMsg)
        }
    }

    const cobrarTurno = (turno) => {
        setTurnoACobrar(turno)
        setCobroData({
            efectivo: 0,
            transferencia: 0,
            observaciones: '',
        })
        setShowCobroModal(true)
    }

    const confirmarCobro = async () => {
        if (!turnoACobrar) return

        // Sumar los nuevos pagos a los existentes
        const efectivoExistente = parseFloat(turnoACobrar.efectivo) || 0
        const transferenciaExistente = parseFloat(turnoACobrar.transferencia) || 0
        const nuevoEfectivo = parseFloat(cobroData.efectivo) || 0
        const nuevaTransferencia = parseFloat(cobroData.transferencia) || 0
        
        const totalPagado = efectivoExistente + transferenciaExistente + nuevoEfectivo + nuevaTransferencia
        const totalTurno = parseFloat(turnoACobrar.total) || 0

        // Solo se marca como "Cobrado" si el pago es completo
        const estadoFinal = totalPagado >= totalTurno ? 'Cobrado' : (turnoACobrar.estado || 'Pendiente')

        const turnoActualizado = {
            ...turnoACobrar,
            estado: estadoFinal,
            efectivo: efectivoExistente + nuevoEfectivo,
            transferencia: transferenciaExistente + nuevaTransferencia,
            observaciones: cobroData.observaciones || turnoACobrar.observaciones,
            total: totalTurno
        }

        try {
            await api.put(`/turnos/${turnoACobrar._id}`, turnoActualizado)
            setShowCobroModal(false)
            setTurnoACobrar(null)
            setCobroData({ efectivo: 0, transferencia: 0, observaciones: '' })
            fetchTurnos()
            window.dispatchEvent(new Event('caja-updated'))
            window.dispatchEvent(new Event('turno-updated'))
            if (estadoFinal === 'Cobrado') {
                alert('Turno cobrado correctamente. La caja se ha actualizado.')
            } else {
                const restante = totalTurno - totalPagado
                alert(`Pago registrado. Restante: $${restante.toLocaleString()}`)
            }
        } catch (error) {
            console.error('Error cobrando turno:', error)
            const mensaje = error.response?.data?.error || error.message || 'Error al cobrar el turno'
            alert(`Error al cobrar el turno: ${mensaje}`)
        }
    }

    const deleteTurno = async (id) => {
        // Buscar el turno para verificar su estado
        const turno = turnos.find(t => t._id === id)
        
        // Mensaje diferente para turnos cobrados
        const mensajeConfirmacion = turno && turno.estado === 'Cobrado' 
            ? '¿Eliminar este turno de la sección Turnos? (Permanecerá visible en Histórico)'
            : '¿Eliminar este turno?'
        
        if (!window.confirm(mensajeConfirmacion)) return
        
        try {
            await api.delete(`/turnos/${id}`)
            fetchTurnos()
            window.dispatchEvent(new Event('turno-updated'))
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al eliminar el turno'
            alert(mensaje)
        }
    }

    const getPedidoInfo = (pedidoId) => {
        if (!Array.isArray(pedidos) || !pedidoId) return null
        const pedido = pedidos.find(p => p._id === pedidoId)
        return pedido
    }

    const getOpcionesAsignacion = () => {
        const opciones = []
        
        if (!Array.isArray(mesas) || !Array.isArray(clientes)) {
            return opciones
        }

        // Agregar todas las mesas
        mesas.forEach(mesa => {
            if (!mesa || !mesa._id) return
            opciones.push({
                tipo: 'mesa',
                id: mesa._id,
                label: `Mesa ${mesa.numero || ''}${mesa.nombre ? ` - ${mesa.nombre}` : ''}`
            })
        })

        // Agregar todos los clientes
        clientes.forEach(cliente => {
            if (!cliente || !cliente._id) return
            opciones.push({
                tipo: 'cliente',
                id: cliente._id,
                label: `Cliente #${cliente.numero || ''} - ${cliente.nombre || ''}`
            })
        })

        // Ordenar opciones: primero mesas, luego clientes, ambos alfabéticamente
        opciones.sort((a, b) => {
            if (a.tipo !== b.tipo) {
                return a.tipo === 'mesa' ? -1 : 1
            }
            return a.label.localeCompare(b.label)
        })

        return opciones
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Turnos</h2>
                <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                    + Nuevo Turno
                </button>
            </div>

            {turnos.length === 0 ? (
                <div className="card text-center py-12">
                    <p className="text-slate-400">No hay turnos registrados</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {turnos.map((turno) => (
                                <div key={turno._id} className="card">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-bold text-white">
                                                Turno #{turno.numero || 'N/A'} {turno.nombre ? `- ${turno.nombre}` : ''}
                                            </h3>
                                            <p className="text-sm text-slate-400">
                                                {turno.createdAt ? new Date(turno.createdAt).toLocaleString() : 'Sin fecha'}
                                            </p>
                                        </div>
                                        <span
                                            className={`px-2 py-1 rounded text-xs ${turno.estado === 'Cobrado'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-yellow-600 text-white'
                                                }`}
                                        >
                                            {turno.estado || 'Pendiente'}
                                        </span>
                                    </div>

                                    {/* Información de la asignación (mesa, cliente o pedido) */}
                                    {(turno.mesaNumero || turno.clienteNombre || turno.pedidoId) && (
                                        <div className="mb-3 pb-3 border-b border-slate-700">
                                            <p className="text-xs text-slate-400 mb-1">Asignado a:</p>
                                            {turno.mesaNumero && (
                                                <p className="text-sm text-white">
                                                    Mesa {turno.mesaNumero}
                                                    {turno.mesaNombre && ` - ${turno.mesaNombre}`}
                                                </p>
                                            )}
                                            {turno.clienteNombre && (
                                                <p className="text-sm text-white">
                                                    Cliente #{turno.clienteNumero || ''} - {turno.clienteNombre}
                                                </p>
                                            )}
                                            {turno.pedidoInfo && (
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Pedido Total: ${turno.pedidoInfo.total?.toLocaleString()}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="border-t border-slate-700 pt-4 space-y-2">
                                        <div className="flex justify-between text-lg font-bold text-white">
                                            <span>Total:</span>
                                            <span>${(turno.total || 0).toLocaleString()}</span>
                                        </div>
                                        {(turno.efectivo || 0) > 0 && (
                                            <div className="flex justify-between text-sm text-slate-300">
                                                <span>Efectivo:</span>
                                                <span>${(turno.efectivo || 0).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {(turno.transferencia || 0) > 0 && (
                                            <div className="flex justify-between text-sm text-slate-300">
                                                <span>Transferencia:</span>
                                                <span>${(turno.transferencia || 0).toLocaleString()}</span>
                                            </div>
                                        )}
                                        {(() => {
                                            const totalPagado = (parseFloat(turno.efectivo) || 0) + (parseFloat(turno.transferencia) || 0);
                                            const totalTurno = parseFloat(turno.total) || 0;
                                            const restante = totalTurno - totalPagado;
                                            return ((turno.efectivo || 0) > 0 || (turno.transferencia || 0) > 0) && restante > 0 ? (
                                                <div className="flex justify-between text-sm text-red-400 font-semibold">
                                                    <span>Restante:</span>
                                                    <span>${restante.toLocaleString()}</span>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {turno.observaciones && (
                                        <div className="mt-3 pt-3 border-b border-slate-700">
                                            <p className="text-xs text-slate-400 mb-1">Observaciones:</p>
                                            <p className="text-sm text-slate-300">{turno.observaciones}</p>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                                        {turno.estado !== 'Cobrado' && (
                                            <>
                                                <button
                                                    onClick={() => openEditModal(turno)}
                                                    className="btn-secondary w-full sm:flex-1 text-sm"
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    onClick={() => cobrarTurno(turno)}
                                                    className="btn-primary w-full sm:flex-1 text-sm"
                                                >
                                                    Cobrar
                                                </button>
                                            </>
                                        )}
                                        <button
                                            onClick={() => deleteTurno(turno._id)}
                                            className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 rounded-lg text-sm"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                    ))}
                </div>
            )}

            {/* Modal de Crear/Editar Turno */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingTurno ? 'Editar Turno' : 'Nuevo Turno'}
                        </h3>
                <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nombre (opcional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="input-field"
                                    placeholder="Ej: Turno mañana"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Asignar a Mesa o Cliente (opcional)
                                </label>
                                <select
                                    value={formData.asignacionTipo && formData.asignacionId ? `${formData.asignacionTipo}-${formData.asignacionId}` : ''}
                                    onChange={(e) => {
                                        const valor = e.target.value
                                        if (valor === '') {
                                            setFormData({ ...formData, asignacionTipo: '', asignacionId: '', pedidoId: '' })
                                        } else {
                                            const [tipo, id] = valor.split('-')
                                            setFormData({ ...formData, asignacionTipo: tipo, asignacionId: id, pedidoId: '' })
                                        }
                                    }}
                                    className="input-field"
                                >
                                    <option value="">Sin asignar</option>
                                    {getOpcionesAsignacion().map((opcion, index) => (
                                        <option key={`${opcion.tipo}-${opcion.id}-${index}`} value={`${opcion.tipo}-${opcion.id}`}>
                                            {opcion.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Total *
                                </label>
                                <input
                                    type="number"
                                    value={formData.total}
                                    onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                                    className="input-field"
                                    placeholder="0"
                                    required
                                    step="0.01"
                                    min="0"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Efectivo
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.efectivo}
                                        onChange={(e) => setFormData({ ...formData, efectivo: e.target.value })}
                                        onFocus={(e) => {
                                            if (e.target.value === '0') {
                                                e.target.value = ''
                                                setFormData({ ...formData, efectivo: '' })
                                            }
                                        }}
                                        className="input-field"
                                        placeholder="0"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Transferencia
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.transferencia}
                                        onChange={(e) => setFormData({ ...formData, transferencia: e.target.value })}
                                        onFocus={(e) => {
                                            if (e.target.value === '0') {
                                                e.target.value = ''
                                                setFormData({ ...formData, transferencia: '' })
                                            }
                                        }}
                                        className="input-field"
                                        placeholder="0"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observaciones
                                </label>
                                <textarea
                                    value={formData.observaciones}
                                    onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
                                    className="input-field"
                                    rows="3"
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 mt-6">
                                <button onClick={saveTurno} className="btn-primary w-full sm:flex-1">
                                    {editingTurno ? 'Actualizar' : 'Crear'}
                                </button>
                                <button
                                    onClick={() => { setShowModal(false); setEditingTurno(null) }}
                                    className="btn-secondary w-full sm:flex-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Cobro */}
            {showCobroModal && turnoACobrar && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Cobrar Turno #{turnoACobrar.numero}
                        </h3>

                        <div className="space-y-4">
                            <div className="bg-slate-700 p-3 rounded-lg">
                                <div className="flex justify-between text-white mb-2">
                                    <span>Total:</span>
                                    <span className="font-bold">${turnoACobrar.total?.toLocaleString()}</span>
                                </div>
                                {(() => {
                                    const efectivoExistente = parseFloat(turnoACobrar.efectivo) || 0
                                    const transferenciaExistente = parseFloat(turnoACobrar.transferencia) || 0
                                    const totalPagadoAnterior = efectivoExistente + transferenciaExistente
                                    const totalTurno = parseFloat(turnoACobrar.total) || 0
                                    const totalACobrar = totalTurno - totalPagadoAnterior
                                    const nuevoEfectivo = parseFloat(cobroData.efectivo) || 0
                                    const nuevaTransferencia = parseFloat(cobroData.transferencia) || 0
                                    const totalNuevoPago = nuevoEfectivo + nuevaTransferencia
                                    const restante = totalACobrar - totalNuevoPago
                                    
                                    return (
                                        <>
                                            {totalPagadoAnterior > 0 && (
                                                <div className="flex justify-between text-sm text-slate-300 mb-1">
                                                    <span>Pagado anteriormente:</span>
                                                    <span>${totalPagadoAnterior.toLocaleString()}</span>
                                                </div>
                                            )}
                                            <div className="flex justify-between text-sm text-yellow-400 mb-2">
                                                <span>Restante a cobrar:</span>
                                                <span className="font-semibold">${totalACobrar.toLocaleString()}</span>
                                            </div>
                                            {totalNuevoPago > 0 && (
                                                <div className="flex justify-between text-sm text-green-400 mb-1">
                                                    <span>Nuevo pago:</span>
                                                    <span>${totalNuevoPago.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {totalNuevoPago > 0 && restante > 0 && (
                                                <div className="flex justify-between text-sm text-red-400 font-semibold mt-2 pt-2 border-t border-slate-600">
                                                    <span>Restante después del pago:</span>
                                                    <span>${restante.toLocaleString()}</span>
                                                </div>
                                            )}
                                            {restante <= 0 && totalNuevoPago > 0 && (
                                                <div className="text-sm text-green-400 font-semibold mt-2 pt-2 border-t border-slate-600">
                                                    ✓ Pago completo
                                                </div>
                                            )}
                                        </>
                                    )
                                })()}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Efectivo
                                    </label>
                                    <input
                                        type="number"
                                        value={cobroData.efectivo}
                                        onChange={(e) => setCobroData({ ...cobroData, efectivo: e.target.value })}
                                        onFocus={(e) => {
                                            if (e.target.value === '0') {
                                                e.target.value = ''
                                                setCobroData({ ...cobroData, efectivo: '' })
                                            }
                                        }}
                                        className="input-field"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Transferencia
                                    </label>
                                    <input
                                        type="number"
                                        value={cobroData.transferencia}
                                        onChange={(e) => setCobroData({ ...cobroData, transferencia: e.target.value })}
                                        onFocus={(e) => {
                                            if (e.target.value === '0') {
                                                e.target.value = ''
                                                setCobroData({ ...cobroData, transferencia: '' })
                                            }
                                        }}
                                        className="input-field"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observaciones
                                </label>
                                <textarea
                                    value={cobroData.observaciones}
                                    onChange={(e) => setCobroData({ ...cobroData, observaciones: e.target.value })}
                                    className="input-field"
                                    rows="2"
                                    placeholder="Observaciones adicionales..."
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-6">
                            <button onClick={confirmarCobro} className="btn-primary w-full sm:flex-1">
                                Confirmar Cobro
                            </button>
                            <button
                                onClick={() => {
                                    setShowCobroModal(false)
                                    setTurnoACobrar(null)
                                    setCobroData({ efectivo: 0, transferencia: 0, observaciones: '' })
                                }}
                                className="btn-secondary w-full sm:flex-1"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Turnos

