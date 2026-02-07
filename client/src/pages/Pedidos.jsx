import { useEffect, useState } from 'react'
import api from '../utils/api'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { toastError, toastInfo, toastSuccess } from '../utils/toast'
import { useModalHotkeys } from '../hooks/useModalHotkeys'

const Pedidos = () => {
    const [pedidos, setPedidos] = useState([])
    const [productos, setProductos] = useState([])
    const [mesas, setMesas] = useState([])
    const [clientes, setClientes] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingPedido, setEditingPedido] = useState(null)
    const [formData, setFormData] = useState({
        mesaId: '',
        clienteId: '',
        items: [],
    })
    const [selectedProducto, setSelectedProducto] = useState(null)
    const [cantidad, setCantidad] = useState(1)
    const [precioPersonalizado, setPrecioPersonalizado] = useState('')
    const [productoFiltro, setProductoFiltro] = useState('')
    const [showCobroModal, setShowCobroModal] = useState(false)
    const [pedidoACobrar, setPedidoACobrar] = useState(null)
    const [cobroData, setCobroData] = useState({
        efectivo: 0,
        transferencia: 0,
        observaciones: '',
    })

    useLockBodyScroll(!!showModal || !!showCobroModal)

    const capitalizeFirst = (value) => {
        const s = (value ?? '').toString().trim()
        if (!s) return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
    }

    useEffect(() => {
        fetchPedidos()
        fetchProductos()
        fetchMesas()
        fetchClientes()
    }, [])

    const fetchPedidos = async () => {
        try {
            const res = await api.get('/pedidos')
            // Mostrar todos los pedidos NO cobrados (incluye cuenta corriente / pagos parciales)
            const pedidosFiltrados = res.data.filter((p) => {
                const est = String(p?.estado || '').toLowerCase()
                return est !== 'cobrado' && est !== 'cancelado'
            })
            setPedidos(pedidosFiltrados)
        } catch (error) {
            console.error('Error fetching pedidos:', error)
        }
    }

    const fetchProductos = async () => {
        try {
            const res = await api.get('/productos')
            setProductos(res.data)
        } catch (error) {
            console.error('Error fetching productos:', error)
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

    const openEditModal = (pedido = null) => {
        setProductoFiltro('')
        if (pedido) {
            const mesaId =
                typeof pedido.mesaId === 'object' && pedido.mesaId !== null ? pedido.mesaId._id : (pedido.mesaId || '')
            const clienteId =
                typeof pedido.clienteId === 'object' && pedido.clienteId !== null ? pedido.clienteId._id : (pedido.clienteId || '')
            setFormData({
                mesaId,
                clienteId,
                items: pedido.items || [],
            })
        } else {
            setFormData({
                mesaId: '',
                clienteId: '',
                items: [],
            })
        }
        setEditingPedido(pedido)
        setShowModal(true)
    }

    const productosFiltrados = Array.isArray(productos)
        ? productos.filter((p) => {
            if (!p) return false
            if (!productoFiltro.trim()) return true
            return String(p.nombre || '').toLowerCase().includes(productoFiltro.trim().toLowerCase())
        })
        : []

    const maybeLoadExistingPedido = async ({ mesaId, clienteId }) => {
        try {
            if (editingPedido) return
            if (formData.items?.length) return
            if (!mesaId && !clienteId) return

            const res = await api.get('/pedidos')
            const pedidosArray = Array.isArray(res.data) ? res.data : []
            const candidatos = pedidosArray.filter((p) => {
                if (!p) return false
                const est = String(p.estado || '').toLowerCase()
                if (est === 'cobrado' || est === 'cancelado') return false
                if (mesaId) {
                    const mid = typeof p.mesaId === 'object' && p.mesaId !== null ? p.mesaId._id : p.mesaId
                    if (String(mid) !== String(mesaId)) return false
                }
                if (clienteId) {
                    const cid = typeof p.clienteId === 'object' && p.clienteId !== null ? p.clienteId._id : p.clienteId
                    if (String(cid) !== String(clienteId)) return false
                }
                return true
            })
            const existente = candidatos.sort(
                (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            )[0]
            if (!existente?._id) return

            setEditingPedido(existente)
            setFormData({
                mesaId: mesaId || (typeof existente.mesaId === 'object' && existente.mesaId !== null ? existente.mesaId._id : (existente.mesaId || '')),
                clienteId: clienteId || (typeof existente.clienteId === 'object' && existente.clienteId !== null ? existente.clienteId._id : (existente.clienteId || '')),
                items: Array.isArray(existente.items) ? existente.items : [],
            })
            toastInfo('Pedido existente cargado')
        } catch (error) {
            console.error('Error cargando pedido existente:', error)
        }
    }

    const addItem = () => {
        if (!selectedProducto) return
        const producto = productos.find((p) => p._id === selectedProducto)
        if (!producto) return

        const precio = precioPersonalizado
            ? parseFloat(precioPersonalizado)
            : producto.precio

        const newItem = {
            productoId: producto._id,
            nombre: producto.nombre,
            cantidad: parseInt(cantidad),
            precio: precio,
            precioOriginal: producto.precio,
        }

        setFormData({
            ...formData,
            items: [...formData.items, newItem],
        })
        setSelectedProducto(null)
        setCantidad(1)
        setPrecioPersonalizado('')
    }

    const removeItem = (index) => {
        setFormData({
            ...formData,
            items: formData.items.filter((_, i) => i !== index),
        })
    }

    const updateItemQuantity = (index, newCantidad) => {
        if (newCantidad < 1) return
        const updatedItems = formData.items.map((item, i) =>
            i === index ? { ...item, cantidad: parseInt(newCantidad) } : item
        )
        setFormData({
            ...formData,
            items: updatedItems,
        })
    }

    const calcularTotal = () => {
        return formData.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
    }

    const calcularRestante = () => {
        const total = calcularTotal()
        return total
    }

    const savePedido = async () => {
        try {
            const total = calcularTotal()
            const data = {
                ...formData,
                total,
            }

            // Si hay una mesa seleccionada, actualizar su estado a "ocupada"
            if (formData.mesaId) {
                try {
                    await api.put(`/mesas/${formData.mesaId}`, {
                        estado: 'ocupada'
                    })
                    window.dispatchEvent(new Event('mesa-updated'))
                } catch (error) {
                    console.error('Error actualizando estado de mesa', error)
                }
            }

            const payload = {
                ...data,
                ...(data.clienteId ? { estado: 'Cuenta Corriente' } : {}),
            }

            // Si ya existe un pedido pendiente para esa mesa/cliente, agrandar el mismo (no crear otro)
            if (!editingPedido && (payload.mesaId || payload.clienteId)) {
                try {
                    const res = await api.get('/pedidos')
                    const pedidosArray = Array.isArray(res.data) ? res.data : []
                    const candidatos = pedidosArray.filter((p) => {
                        if (!p) return false
                        const est = String(p.estado || '').toLowerCase()
                        if (est === 'cobrado' || est === 'cancelado') return false
                        if (payload.mesaId) {
                            const mid = typeof p.mesaId === 'object' && p.mesaId !== null ? p.mesaId._id : p.mesaId
                            if (String(mid) !== String(payload.mesaId)) return false
                        }
                        if (payload.clienteId) {
                            const cid = typeof p.clienteId === 'object' && p.clienteId !== null ? p.clienteId._id : p.clienteId
                            if (String(cid) !== String(payload.clienteId)) return false
                        }
                        return true
                    })
                    const existente = candidatos.sort(
                        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
                    )[0]
                    if (existente?._id) {
                        const existingItems = Array.isArray(existente.items) ? existente.items : []
                        const mergedItems = [...existingItems, ...(payload.items || [])]
                        const mergedTotal = mergedItems.reduce(
                            (sum, it) => sum + (Number(it?.precio || 0) * Number(it?.cantidad || 0)),
                            0
                        )
                        await api.put(`/pedidos/${existente._id}`, {
                            mesaId: payload.mesaId || null,
                            clienteId: payload.clienteId || null,
                            items: mergedItems,
                            total: mergedTotal,
                            ...(payload.clienteId ? { estado: 'Cuenta Corriente' } : {}),
                        })
                        setShowModal(false)
                        setEditingPedido(null)
                        fetchPedidos()
                        return
                    }
                } catch (e) {
                    // si falla la búsqueda, seguimos con create normal
                    console.error('Error buscando pedido existente:', e)
                }
            }

            if (editingPedido) await api.put(`/pedidos/${editingPedido._id}`, payload)
            else await api.post('/pedidos', payload)

            setShowModal(false)
            setEditingPedido(null)
            fetchPedidos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al guardar el pedido'
            toastError(errorMsg)
        }
    }

    const cobrarPedido = (pedido) => {
        // Guardar el pedido que vamos a cobrar
        setPedidoACobrar(pedido)
        // Inicializar los datos de cobro limpios para ingresar el nuevo pago
        setCobroData({
            efectivo: 0,
            transferencia: 0,
            observaciones: '',
        })
        // Abrir el modal de cobro
        setShowCobroModal(true)
    }

    const confirmarCobro = async () => {
        if (!pedidoACobrar) return

        // Sumar los nuevos pagos a los existentes
        const efectivoExistente = parseFloat(pedidoACobrar.efectivo) || 0
        const transferenciaExistente = parseFloat(pedidoACobrar.transferencia) || 0
        const nuevoEfectivo = parseFloat(cobroData.efectivo) || 0
        const nuevaTransferencia = parseFloat(cobroData.transferencia) || 0

        const totalPagado = efectivoExistente + transferenciaExistente + nuevoEfectivo + nuevaTransferencia
        const totalPedido = parseFloat(pedidoACobrar.total) || 0

        // Solo se marca como "Cobrado" si el pago es completo
        const estadoFinal = totalPagado === totalPedido ? 'Cobrado' : (pedidoACobrar.estado || 'Pendiente')

        const pedidoActualizado = {
            ...pedidoACobrar,
            estado: estadoFinal,
            efectivo: efectivoExistente + nuevoEfectivo,
            transferencia: transferenciaExistente + nuevaTransferencia,
            observaciones: cobroData.observaciones || pedidoACobrar.observaciones,
            total: totalPedido
        }

        try {
            await api.put(`/pedidos/${pedidoACobrar._id}`, pedidoActualizado)
            setShowCobroModal(false)
            setPedidoACobrar(null)
            setCobroData({ efectivo: 0, transferencia: 0, observaciones: '' })
            fetchPedidos()
            window.dispatchEvent(new Event('caja-updated'))
            if (estadoFinal === 'Cobrado') {
                toastSuccess('Pedido cobrado. Caja actualizada.')
            } else {
                const restante = totalPedido - totalPagado
                toastInfo(`Pago registrado. Restante: $${restante.toLocaleString()}`)
            }
        } catch (error) {
            console.error('Error cobrando pedido:', error)
            const mensaje = error.response?.data?.error || error.message || 'Error al cobrar el pedido'
            toastError(`Error al cobrar el pedido: ${mensaje}`)
        }
    }

    const deletePedido = async (id) => {
        if (!window.confirm('¿Eliminar este pedido?')) return
        try {
            await api.delete(`/pedidos/${id}`)
            fetchPedidos()
        } catch (error) {
            console.error('Error deleting pedido:', error)
            toastError('Error al eliminar el pedido')
        }
    }

    // Hotkeys modales: ESC = cancelar, ENTER = confirmar
    useModalHotkeys({
        isOpen: showModal,
        onCancel: () => { setShowModal(false); setEditingPedido(null) },
        onConfirm: savePedido,
    })
    useModalHotkeys({
        isOpen: showCobroModal,
        onCancel: () => { setShowCobroModal(false); setPedidoACobrar(null) },
        onConfirm: confirmarCobro,
    })

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Pedidos</h2>
                <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                    + Nuevo Pedido
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pedidos.map((pedido) => (
                    <div key={pedido._id} className="card">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">
                                    {pedido.mesaId
                                        ? (() => {
                                            // `mesaId` puede venir como string (ObjectId) o como objeto (populate)
                                            if (typeof pedido.mesaId === 'object' && pedido.mesaId !== null) {
                                                const numero = pedido.mesaId.numero ?? ''
                                                const nombre = capitalizeFirst(pedido.mesaId.nombre)
                                                return `Mesa ${numero}${nombre ? ` - ${nombre}` : ''}`.trim()
                                            }

                                            const mesa = mesas.find((m) => m._id === pedido.mesaId || m._id === String(pedido.mesaId))
                                            return mesa
                                                ? `Mesa ${mesa.numero}${mesa.nombre ? ` - ${capitalizeFirst(mesa.nombre)}` : ''}`
                                                : 'Mesa N/A'
                                        })()
                                        : 'Sin Mesa'}
                                </h3>
                                {pedido.clienteId && (
                                    <p className="text-sm text-slate-300">
                                        Cliente:{' '}
                                        {typeof pedido.clienteId === 'object' && pedido.clienteId !== null
                                            ? (pedido.clienteId.nombre || 'N/A')
                                            : (clientes.find((c) => String(c._id) === String(pedido.clienteId))?.nombre || 'N/A')}
                                    </p>
                                )}
                                <p className="text-sm text-slate-400">
                                    {new Date(pedido.createdAt).toLocaleString()}
                                </p>
                            </div>
                            <span
                                className={`px-2 py-1 rounded text-xs ${pedido.estado === 'Cobrado'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-yellow-600 text-white'
                                    }`}
                            >
                                {pedido.estado}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            {pedido.items?.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span className="text-slate-300">
                                        {item.cantidad}x {item.nombre}
                                    </span>
                                    <span className="text-white font-semibold">
                                        ${(item.precio * item.cantidad).toLocaleString()}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-slate-700 pt-4 space-y-2">
                            <div className="flex justify-between text-lg font-bold text-white">
                                <span>Total:</span>
                                <span>${pedido.total?.toLocaleString()}</span>
                            </div>
                            {pedido.efectivo > 0 && (
                                <div className="flex justify-between text-sm text-slate-300">
                                    <span>Efectivo:</span>
                                    <span>${pedido.efectivo.toLocaleString()}</span>
                                </div>
                            )}
                            {pedido.transferencia > 0 && (
                                <div className="flex justify-between text-sm text-slate-300">
                                    <span>Transferencia:</span>
                                    <span>${pedido.transferencia.toLocaleString()}</span>
                                </div>
                            )}
                            {(() => {
                                const totalPagado = (parseFloat(pedido.efectivo) || 0) + (parseFloat(pedido.transferencia) || 0);
                                const restante = parseFloat(pedido.total) - totalPagado;
                                return (pedido.efectivo > 0 || pedido.transferencia > 0) && restante > 0 ? (
                                    <div className="flex justify-between text-sm text-red-400 font-semibold">
                                        <span>Restante:</span>
                                        <span>${restante.toLocaleString()}</span>
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2 mt-4">
                            {pedido.estado !== 'cobrado' && (
                                <>
                                    <button
                                        onClick={() => openEditModal(pedido)}
                                        className="btn-secondary w-full sm:flex-1 text-sm"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        onClick={() => cobrarPedido(pedido)}
                                        className="btn-primary w-full sm:flex-1 text-sm"
                                    >
                                        Cobrar
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => deletePedido(pedido._id)}
                                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto px-4 py-2 rounded-lg text-sm"
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Pedido */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingPedido ? 'Editar Pedido' : 'Nuevo Pedido'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Mesa (opcional)
                                </label>
                                <select
                                    value={formData.mesaId}
                                    onChange={(e) => {
                                        const mesaId = e.target.value
                                        setFormData({ ...formData, mesaId })
                                        void maybeLoadExistingPedido({ mesaId, clienteId: formData.clienteId })
                                    }}
                                    className="input-field"
                                >
                                    <option value="">Sin Mesa</option>
                                    {mesas.map((mesa) => (
                                        <option key={mesa._id} value={mesa._id}>
                                            Mesa {mesa.numero} - {mesa.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Cliente (opcional)
                                </label>
                                <select
                                    value={formData.clienteId || ''}
                                    onChange={(e) => {
                                        const clienteId = e.target.value
                                        setFormData({ ...formData, clienteId })
                                        void maybeLoadExistingPedido({ mesaId: formData.mesaId, clienteId })
                                    }}
                                    className="input-field"
                                >
                                    <option value="">Sin Cliente</option>
                                    {clientes.map((c) => (
                                        <option key={c._id} value={c._id}>
                                            #{c.numero} - {c.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Agregar Producto</h4>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-2">
                                    <input
                                        type="text"
                                        value={productoFiltro}
                                        onChange={(e) => setProductoFiltro(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key !== 'Enter') return
                                            e.preventDefault()
                                            e.stopPropagation()
                                            const first = productosFiltrados?.[0]
                                            if (first?._id) setSelectedProducto(first._id)
                                        }}
                                        placeholder="Buscar producto..."
                                        className="input-field w-full sm:w-56"
                                    />
                                    <select
                                        value={selectedProducto || ''}
                                        onChange={(e) => setSelectedProducto(e.target.value)}
                                        className="input-field w-full sm:flex-1"
                                    >
                                        <option value="">Seleccionar producto</option>
                                        {productosFiltrados.map((prod) => (
                                            <option key={prod._id} value={prod._id}>
                                                {prod.nombre} - ${prod.precio.toLocaleString()}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="flex w-full sm:w-auto items-center border border-slate-600 rounded h-10 sm:h-auto">
                                        <button
                                            onClick={() => setCantidad(Math.max(1, (parseInt(cantidad) || 1) - 1))}
                                            className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                            type="button"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={cantidad}
                                            onChange={(e) => setCantidad(e.target.value)}
                                            className="flex-1 sm:flex-none sm:w-12 h-10 sm:h-auto text-center text-white bg-transparent border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            min="1"
                                        />
                                        <button
                                            onClick={() => setCantidad((parseInt(cantidad) || 1) + 1)}
                                            className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                            type="button"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        value={precioPersonalizado}
                                        onChange={(e) => setPrecioPersonalizado(e.target.value)}
                                        placeholder="Editar Precio"
                                        className="input-field w-full sm:w-36"
                                        step="0.01"
                                    />
                                    <button onClick={addItem} className="btn-primary w-full sm:w-auto">
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Items del Pedido</h4>
                                {formData.items.length === 0 ? (
                                    <p className="text-slate-400 text-sm">No hay items agregados</p>
                                ) : (
                                    <div className="space-y-2">
                                        {formData.items.map((item, idx) => (
                                            <div
                                                key={idx}
                                                className="flex justify-between items-center bg-slate-700 p-2 rounded"
                                            >
                                                <span className="text-white text-sm flex-1">
                                                    {item.nombre} - ${item.precio.toLocaleString()}
                                                    {item.precioOriginal != null &&
                                                        Number(item.precio) !== Number(item.precioOriginal) && (
                                                            <span className="text-yellow-400 ml-2">(precio modificado)</span>
                                                        )}
                                                </span>
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex items-center border border-slate-600 rounded h-10 sm:h-auto">
                                                        <button
                                                            onClick={() => updateItemQuantity(idx, item.cantidad - 1)}
                                                            className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.cantidad}
                                                            onChange={(e) => updateItemQuantity(idx, e.target.value)}
                                                            min="1"
                                                            className="w-12 h-10 sm:h-auto text-center text-white bg-slate-700 border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <button
                                                            onClick={() => updateItemQuantity(idx, item.cantidad + 1)}
                                                            className="w-10 h-10 sm:w-auto sm:h-auto flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItem(idx)}
                                                        className="text-red-400 hover:text-red-300"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-700 p-3 rounded-lg">
                                <div className="flex justify-between text-white mb-2">
                                    <span>Total:</span>
                                    <span className="font-bold">${calcularTotal().toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={savePedido} className="btn-primary w-full sm:flex-1">
                                    Guardar
                                </button>
                                <button
                                    onClick={() => { setShowModal(false); setEditingPedido(null) }}
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
            {showCobroModal && pedidoACobrar && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Cobrar Pedido - {(() => {
                                const mesa = mesas.find((m) => m._id === pedidoACobrar.mesaId)
                                return mesa
                                    ? `Mesa ${mesa.numero}${mesa.nombre ? ` - ${mesa.nombre}` : ''}`
                                    : 'Mesa N/A'
                            })()}
                        </h3>

                        <div className="space-y-4">
                            {(() => {
                                const efectivoExistente = parseFloat(pedidoACobrar.efectivo) || 0
                                const transferenciaExistente = parseFloat(pedidoACobrar.transferencia) || 0
                                const totalPagadoAnterior = efectivoExistente + transferenciaExistente
                                const totalPedido = parseFloat(pedidoACobrar.total) || 0
                                const totalACobrar = totalPedido - totalPagadoAnterior
                                const nuevoEfectivo = parseFloat(cobroData.efectivo) || 0
                                const nuevaTransferencia = parseFloat(cobroData.transferencia) || 0
                                const totalNuevoPago = nuevoEfectivo + nuevaTransferencia
                                const restante = totalACobrar - totalNuevoPago

                                return (
                                    <>
                                        <div className="bg-slate-700 p-3 rounded-lg">
                                            <div className="flex justify-between text-white mb-2">
                                                <span>Total a Cobrar:</span>
                                                <span className="font-bold">${totalACobrar.toLocaleString()}</span>
                                            </div>
                                            {totalPagadoAnterior > 0 && (
                                                <div className="flex justify-between text-slate-300 text-xs mt-2">
                                                    <span>Ya pagado:</span>
                                                    <span>${totalPagadoAnterior.toLocaleString()}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                                    Efectivo
                                                </label>
                                                <input
                                                    type="number"
                                                    value={cobroData.efectivo}
                                                    onChange={(e) =>
                                                        setCobroData({ ...cobroData, efectivo: e.target.value })
                                                    }
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
                                                    onChange={(e) =>
                                                        setCobroData({ ...cobroData, transferencia: e.target.value })
                                                    }
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

                                        <div className="bg-slate-700 p-3 rounded-lg">
                                            <div className="flex justify-between text-slate-300 text-sm mb-2">
                                                <span>Total Pagado (nuevo):</span>
                                                <span>
                                                    ${totalNuevoPago.toLocaleString()}
                                                </span>
                                            </div>
                                            <div
                                                className={`flex justify-between font-semibold ${restante > 0
                                                    ? 'text-red-400'
                                                    : 'text-green-400'
                                                    }`}
                                            >
                                                <span>Restante:</span>
                                                <span>
                                                    ${restante.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    </>
                                )
                            })()}

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observaciones de Transferencia
                                </label>
                                <textarea
                                    value={cobroData.observaciones}
                                    onChange={(e) =>
                                        setCobroData({ ...cobroData, observaciones: e.target.value })
                                    }
                                    className="input-field"
                                    rows="3"
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={confirmarCobro} className="btn-primary w-full sm:flex-1">
                                    Confirmar Cobro
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCobroModal(false)
                                        setPedidoACobrar(null)
                                        setCobroData({ efectivo: 0, transferencia: 0, observaciones: '' })
                                    }}
                                    className="btn-secondary w-full sm:flex-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Pedidos



