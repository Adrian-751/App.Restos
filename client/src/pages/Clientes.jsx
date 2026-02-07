import { useEffect, useState } from 'react'
import api from '../utils/api'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { toastError, toastInfo, toastSuccess } from '../utils/toast'
import { useModalHotkeys } from '../hooks/useModalHotkeys'
import ProductCombobox from '../components/ProductCombobox'

const Clientes = () => {
    const [clientes, setClientes] = useState([])
    const [productos, setProductos] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingCliente, setEditingCliente] = useState(null)

    const [showPagoModal, setShowPagoModal] = useState(false)
    const [selectedCliente, setSelectedCliente] = useState(null)
    const [formData, setFormData] = useState({ nombre: '', numero: '' })
    const [pagoData, setPagoData] = useState({
        monto: '',
        efectivo: '',
        transferencia: '',
        observaciones: '',
    })

    const [clienteParaPedido, setClienteParaPedido] = useState(null)
    const [pedidosCliente, setPedidosCliente] = useState([])
    const [showEditPedidoModal, setShowEditPedidoModal] = useState(false)
    const [pedidoEditando, setPedidoEditando] = useState(null)
    const [showCobroModal, setShowCobroModal] = useState(false)
    const [pedidoACobrar, setPedidoACobrar] = useState(null)
    const [cobroData, setCobroData] = useState({
        efectivo: 0,
        transferencia: 0,
        observaciones: '',
    })

    // Estados para nuevo pedido
    const [showNuevoPedidoModal, setShowNuevoPedidoModal] = useState(false)
    const [pedidoFormData, setPedidoFormData] = useState({
        clienteId: '',
        items: [],
    })
    const [selectedProducto, setSelectedProducto] = useState(null)
    const [cantidad, setCantidad] = useState(1)
    const [precioPersonalizado, setPrecioPersonalizado] = useState('')

    // Estados para editar pedidos del cliente
    const [showEditPedidosClienteModal, setShowEditPedidosClienteModal] = useState(false)
    const [clienteEditandoPedidos, setClienteEditandoPedidos] = useState(null)
    const [editPedidosFormData, setEditPedidosFormData] = useState({
        items: [],
    })
    const [selectedProductoEdit, setSelectedProductoEdit] = useState(null)
    const [cantidadEdit, setCantidadEdit] = useState(1)
    const [precioPersonalizadoEdit, setPrecioPersonalizadoEdit] = useState('')

    useLockBodyScroll(
        !!showModal ||
        !!showPagoModal ||
        !!showNuevoPedidoModal ||
        !!showEditPedidosClienteModal ||
        !!showCobroModal ||
        !!showEditPedidoModal
    )

    useEffect(() => {
        fetchClientes()
        fetchProductos()
    }, [])

    const fetchClientes = async () => {
        try {
            const res = await api.get('/clientes')
            setClientes(res.data)
        } catch (error) {
            console.error('Error fetching clientes:', error)
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

    const fetchPedidosCliente = async (clienteId) => {
        try {
            const res = await api.get('/pedidos')
            // Filtrar solo pedidos del cliente que no estén cobrados
            const pedidosDelCliente = res.data.filter(p => {
                const cid =
                    typeof p.clienteId === 'object' && p.clienteId !== null ? p.clienteId._id : p.clienteId
                return String(cid) === String(clienteId) && p.estado?.toLowerCase() !== 'cobrado'
            })
            setPedidosCliente(pedidosDelCliente)
        } catch (error) {
            console.error('Error fetching pedidos:', error)
        }
    }

    const openEditModal = (cliente = null) => {
        if (cliente) {
            setFormData({ nombre: cliente.nombre, numero: cliente.numero })
        } else {
            setFormData({ nombre: '', numero: '' })
        }
        setEditingCliente(cliente)
        setShowModal(true)
    }

    const openPagoModal = (cliente) => {
        setSelectedCliente(cliente)
        setPagoData({ monto: '', efectivo: '', transferencia: '', observaciones: '' })
        setShowPagoModal(true)
    }

    const saveCliente = async () => {
        try {
            if (editingCliente) {
                await api.put(`/clientes/${editingCliente._id}`, formData)
            } else {
                await api.post('/clientes', formData)
            }
            setShowModal(false)
            setEditingCliente(null)
            fetchClientes()
        } catch (error) {
            const errorMsg = error.response?.data?.error ||
                error.response?.data?.errors?.[0]?.msg ||
                'Error al guardar el cliente'
            toastError(errorMsg)
        }
    }

    const savePago = async () => {
        try {
            const montoTotal =
                parseFloat(pagoData.efectivo || 0) + parseFloat(pagoData.transferencia || 0)
            await api.post(`/clientes/${selectedCliente._id}/pago`, {
                monto: montoTotal,
                efectivo: parseFloat(pagoData.efectivo || 0),
                transferencia: parseFloat(pagoData.transferencia || 0),
                observaciones: pagoData.observaciones,
            })
            setShowPagoModal(false)
            fetchClientes()
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al registrar el pago'
            toastError(errorMsg)
        }
    }


    const openEditPedidoModal = (pedido) => {
        setPedidoEditando(pedido)
        setPedidoFormData({
            items: pedido.items || [],
        })
        setSelectedProducto(null)
        setCantidad(1)
        setPrecioPersonalizado('')
        setShowEditPedidoModal(true)
    }

    const saveEditPedido = async () => {
        if (!pedidoEditando) return

        try {
            const total = pedidoFormData.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
            const diferencia = total - (pedidoEditando.total || 0)

            await api.put(`/pedidos/${pedidoEditando._id}`, {
                ...pedidoEditando,
                items: pedidoFormData.items,
                total: total,
            })

            // Si el pedido es de cuenta corriente y cambió el total, actualizar cuenta
            if (pedidoEditando.clienteId && diferencia !== 0) {
                const clientesRes = await api.get('/clientes')
                const cliente = clientesRes.data.find(c => c._id === pedidoEditando.clienteId)
                if (cliente) {
                    await api.put(`/clientes/${cliente._id}`, {
                        ...cliente,
                        cuentaCorriente: (cliente.cuentaCorriente || 0) + diferencia
                    })
                }
            }

            setShowEditPedidoModal(false)
            setPedidoEditando(null)
            fetchClientes()
            if (clienteParaPedido) {
                fetchPedidosCliente(clienteParaPedido._id)
            }
            toastSuccess('Pedido actualizado')
        } catch (error) {
            console.error('Error updating pedido:', error)
            toastError('Error al actualizar el pedido')
        }
    }

    const cobrarPedidoCliente = (pedido) => {
        setPedidoACobrar(pedido)
        // Inicializar los datos de cobro limpios para ingresar el nuevo pago
        setCobroData({
            efectivo: 0,
            transferencia: 0,
            observaciones: '',
        })
        setShowCobroModal(true)
    }

    const confirmarCobroCliente = async () => {
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

        try {
            await api.put(`/pedidos/${pedidoACobrar._id}`, {
                ...pedidoACobrar,
                estado: estadoFinal,
                efectivo: efectivoExistente + nuevoEfectivo,
                transferencia: transferenciaExistente + nuevaTransferencia,
                observaciones: cobroData.observaciones || pedidoACobrar.observaciones,
                total: totalPedido
            })
            setShowCobroModal(false)
            setPedidoACobrar(null)
            setCobroData({ efectivo: 0, transferencia: 0, observaciones: '' })
            fetchClientes()
            if (clienteParaPedido) {
                fetchPedidosCliente(clienteParaPedido._id)
            }
            window.dispatchEvent(new Event('caja-updated'))
            if (estadoFinal === 'Cobrado') {
                toastSuccess('Pedido cobrado. Caja actualizada.')
            } else {
                const restante = totalPedido - totalPagado
                toastInfo(`Pago registrado. Restante: $${restante.toLocaleString()}`)
            }
        } catch (error) {
            console.error('Error cobrando pedido:', error)
            toastError('Error al cobrar el pedido')
        }
    }

    const deletePedidoCliente = async (pedidoId) => {
        if (!window.confirm('¿Eliminar este pedido?')) return
        try {
            const pedido = pedidosCliente.find(p => p._id === pedidoId)
            if (pedido && pedido.clienteId) {
                // Restar de la cuenta corriente si el pedido no estaba cobrado
                if (pedido.estado?.toLowerCase() !== 'cobrado') {
                    const clientesRes = await api.get('/clientes')
                    const cliente = clientesRes.data.find(c => c._id === pedido.clienteId)
                    if (cliente) {
                        await api.put(`/clientes/${cliente._id}`, {
                            ...cliente,
                            cuentaCorriente: (cliente.cuentaCorriente || 0) - (pedido.total || 0)
                        })
                    }
                }
            }
            await api.delete(`/pedidos/${pedidoId}`)
            fetchClientes()
            if (clienteParaPedido) {
                fetchPedidosCliente(clienteParaPedido._id)
            }
        } catch (error) {
            console.error('Error deleting pedido:', error)
            toastError('Error al eliminar el pedido')
        }
    }

    const deleteCliente = async (id) => {
        if (!window.confirm('¿Eliminar este cliente?')) return
        try {
            await api.delete(`/clientes/${id}`)
            fetchClientes()
        } catch (error) {
            console.error('Error deleting cliente:', error)
            toastError('Error al eliminar el cliente')
        }
    }

    const calcularRestante = () => {
        const monto = parseFloat(pagoData.monto || 0)
        const pagado =
            parseFloat(pagoData.efectivo || 0) + parseFloat(pagoData.transferencia || 0)
        return monto - pagado
    }

    // Funciones para nuevo pedido
    const openNuevoPedidoModal = () => {
        setClienteParaPedido(null)
        setPedidoFormData({ clienteId: '', items: [] })
        setSelectedProducto(null)
        setCantidad(1)
        setPrecioPersonalizado('')
        setShowNuevoPedidoModal(true)
    }

    const addItemToPedido = () => {
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

        setPedidoFormData({
            ...pedidoFormData,
            items: [...pedidoFormData.items, newItem],
        })
        setSelectedProducto(null)
        setCantidad(1)
        setPrecioPersonalizado('')
    }


    const removeItemFromPedido = (index) => {
        setPedidoFormData({
            ...pedidoFormData,
            items: pedidoFormData.items.filter((_, i) => i !== index),
        })
    }

    const updateItemQuantityPedido = (index, newCantidad) => {
        if (newCantidad < 1) return
        const updatedItems = pedidoFormData.items.map((item, i) =>
            i === index ? { ...item, cantidad: parseInt(newCantidad) } : item
        )
        setPedidoFormData({
            ...pedidoFormData,
            items: updatedItems,
        })
    }

    const calcularTotalPedido = () => {
        return pedidoFormData.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
    }

    // Funciones para editar pedidos del cliente
    const openEditPedidosClienteModal = async (cliente) => {
        try {
            const res = await api.get('/pedidos')
            const pedidosDelCliente = res.data.filter(
                p => {
                    const cid =
                        typeof p.clienteId === 'object' && p.clienteId !== null ? p.clienteId._id : p.clienteId
                    return String(cid) === String(cliente._id) && p.estado?.toLowerCase() !== 'cobrado'
                }
            )

            // Verificar si hay pedidos pendientes
            if (pedidosDelCliente.length === 0) {
                toastInfo('No hay pedidos pendientes')
                return
            }

            // Combinar todos los items de todos los pedidos no cobrados
            const todosLosItems = []
            pedidosDelCliente.forEach(pedido => {
                if (pedido.items && pedido.items.length > 0) {
                    todosLosItems.push(...pedido.items)
                }
            })

            // Si no hay items, también mostrar el mensaje
            if (todosLosItems.length === 0) {
                toastInfo('No hay pedidos pendientes')
                return
            }

            setClienteEditandoPedidos(cliente)
            setEditPedidosFormData({ items: todosLosItems })
            setSelectedProductoEdit(null)
            setCantidadEdit(1)
            setPrecioPersonalizadoEdit('')
            setShowEditPedidosClienteModal(true)
        } catch (error) {
            console.error('Error fetching pedidos:', error)
            toastError('Error al cargar los pedidos del cliente')
        }
    }

    const addItemToEditPedidos = () => {
        if (!selectedProductoEdit) return
        const producto = productos.find((p) => p._id === selectedProductoEdit)
        if (!producto) return

        const precio = precioPersonalizadoEdit
            ? parseFloat(precioPersonalizadoEdit)
            : producto.precio

        const newItem = {
            productoId: producto._id,
            nombre: producto.nombre,
            cantidad: parseInt(cantidadEdit),
            precio: precio,
            precioOriginal: producto.precio,
        }

        setEditPedidosFormData({
            ...editPedidosFormData,
            items: [...editPedidosFormData.items, newItem],
        })
        setSelectedProductoEdit(null)
        setCantidadEdit(1)
        setPrecioPersonalizadoEdit('')
    }


    const removeItemFromEditPedidos = (index) => {
        setEditPedidosFormData({
            ...editPedidosFormData,
            items: editPedidosFormData.items.filter((_, i) => i !== index),
        })
    }

    const updateItemQuantityEditPedidos = (index, newCantidad) => {
        if (newCantidad < 1) return
        const updatedItems = editPedidosFormData.items.map((item, i) =>
            i === index ? { ...item, cantidad: parseInt(newCantidad) } : item
        )
        setEditPedidosFormData({
            ...editPedidosFormData,
            items: updatedItems,
        })
    }

    const calcularTotalEditPedidos = () => {
        return editPedidosFormData.items.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
    }

    const saveEditPedidosCliente = async () => {
        if (!clienteEditandoPedidos) return

        try {
            // Obtener todos los pedidos no cobrados del cliente
            const res = await api.get('/pedidos')
            const pedidosDelCliente = res.data.filter(
                p => {
                    const cid =
                        typeof p.clienteId === 'object' && p.clienteId !== null ? p.clienteId._id : p.clienteId
                    return String(cid) === String(clienteEditandoPedidos._id) && p.estado?.toLowerCase() !== 'cobrado'
                }
            )

            const totalAnterior = pedidosDelCliente.reduce((sum, p) => sum + (p.total || 0), 0)
            const totalNuevo = calcularTotalEditPedidos()
            const diferencia = totalNuevo - totalAnterior

            // Obtener el cliente actual para actualizar su cuenta
            const clientesRes = await api.get('/clientes')
            const cliente = clientesRes.data.find(c => c._id === clienteEditandoPedidos._id)
            if (!cliente) {
                toastError('Cliente no encontrado')
                return
            }

            // Restar el total anterior de la cuenta corriente antes de eliminar los pedidos
            // (el backend no resta automáticamente al eliminar)
            await api.put(`/clientes/${cliente._id}`, {
                ...cliente,
                cuentaCorriente: (cliente.cuentaCorriente || 0) - totalAnterior
            })

            // Eliminar todos los pedidos antiguos no cobrados
            for (const pedido of pedidosDelCliente) {
                await api.delete(`/pedidos/${pedido._id}`)
            }

            // Crear un nuevo pedido con todos los items combinados
            // El backend automáticamente sumará el totalNuevo a la cuenta corriente
            if (editPedidosFormData.items.length > 0) {
                await api.post('/pedidos', {
                    clienteId: clienteEditandoPedidos._id,
                    items: editPedidosFormData.items,
                    total: totalNuevo,
                })
            }

            setShowEditPedidosClienteModal(false)
            setClienteEditandoPedidos(null)
            fetchClientes()
            toastSuccess('Pedidos actualizados')
        } catch (error) {
            console.error('Error updating pedidos:', error)
            toastError('Error al actualizar los pedidos')
        }
    }

    const saveNuevoPedido = async () => {
        if (!pedidoFormData.clienteId) {
            toastInfo('Debes seleccionar un cliente')
            return
        }
        if (pedidoFormData.items.length === 0) {
            toastInfo('Debes agregar al menos un producto al pedido')
            return
        }

        try {
            const total = calcularTotalPedido()
            await api.post('/pedidos', {
                clienteId: pedidoFormData.clienteId,
                items: pedidoFormData.items,
                total: total,
            })
            setShowNuevoPedidoModal(false)
            setClienteParaPedido(null)
            fetchClientes() // Actualizar la cuenta corriente del cliente
            toastSuccess('Pedido agregado a cuenta corriente')
        } catch (error) {
            console.error('Error saving pedido:', error)
            toastError('Error al guardar el pedido')
        }
    }

    // Hotkeys modales: ESC = cancelar, ENTER = confirmar
    useModalHotkeys({
        isOpen: showModal,
        onCancel: () => { setShowModal(false); setEditingCliente(null) },
        onConfirm: saveCliente,
    })
    useModalHotkeys({
        isOpen: showPagoModal,
        onCancel: () => { setShowPagoModal(false); setSelectedCliente(null) },
        onConfirm: savePago,
    })
    useModalHotkeys({
        isOpen: showEditPedidoModal,
        onCancel: () => { setShowEditPedidoModal(false); setPedidoEditando(null) },
        onConfirm: saveEditPedido,
    })
    useModalHotkeys({
        isOpen: showCobroModal,
        onCancel: () => { setShowCobroModal(false); setPedidoACobrar(null) },
        onConfirm: confirmarCobroCliente,
    })
    useModalHotkeys({
        isOpen: showNuevoPedidoModal,
        onCancel: () => { setShowNuevoPedidoModal(false); setClienteParaPedido(null) },
        onConfirm: saveNuevoPedido,
    })
    useModalHotkeys({
        isOpen: showEditPedidosClienteModal,
        onCancel: () => { setShowEditPedidosClienteModal(false); setClienteEditandoPedidos(null) },
        onConfirm: saveEditPedidosCliente,
    })



    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Clientes</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                    <button onClick={openNuevoPedidoModal} className="btn-primary w-full sm:w-auto">
                        + Nuevo Pedido
                    </button>
                    <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                        + Nuevo Cliente
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {clientes.map((cliente) => (
                    <div key={cliente._id} className="card">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">#{cliente.numero}</h3>
                                <p className="text-xl text-white">{cliente.nombre}</p>
                            </div>
                            <span
                                className={`px-3 py-1 rounded text-sm font-semibold ${cliente.cuentaCorriente > 0
                                    ? 'bg-red-600 text-white'
                                    : cliente.cuentaCorriente < 0
                                        ? 'bg-green-600 text-white'
                                        : 'bg-slate-600 text-white'
                                    }`}
                            >
                                ${Math.abs(cliente.cuentaCorriente || 0).toLocaleString()}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Cuenta Corriente:</span>
                                <span
                                    className={`font-semibold ${cliente.cuentaCorriente > 0
                                        ? 'text-red-400'
                                        : cliente.cuentaCorriente < 0
                                            ? 'text-green-400'
                                            : 'text-slate-300'
                                        }`}
                                >
                                    ${cliente.cuentaCorriente?.toLocaleString() || '0'}
                                </span>
                            </div>
                            {cliente.pagos && cliente.pagos.length > 0 && (
                                <div className="text-xs text-slate-500">
                                    {cliente.pagos.length} pago(s) registrado(s)
                                </div>
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                            <button
                                onClick={() => openPagoModal(cliente)}
                                className="btn-primary text-sm w-full sm:flex-1"
                            >
                                Cobrar
                            </button>
                            <button
                                onClick={() => openEditPedidosClienteModal(cliente)}
                                className="btn-secondary text-sm w-full sm:flex-1"
                            >
                                Editar Pedidos
                            </button>
                            <button
                                onClick={() => openEditModal(cliente)}
                                className="btn-secondary text-sm w-full sm:w-auto px-3"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => deleteCliente(cliente._id)}
                                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto px-3 py-2 rounded-lg text-sm"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Cliente */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingCliente ? 'Editar Cliente' : 'Nuevo Cliente'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Número ID
                                </label>
                                <input
                                    type="text"
                                    value={formData.numero}
                                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={formData.nombre}
                                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={saveCliente} className="btn-primary w-full sm:flex-1">
                                    Guardar
                                </button>
                                <button
                                    onClick={() => { setShowModal(false); setEditingCliente(null) }}
                                    className="btn-secondary w-full sm:flex-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPagoModal && selectedCliente && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Cobrar a {selectedCliente.nombre}
                        </h3>
                        <div className="space-y-4">
                            {(() => {
                                const totalPagadoAnterior = selectedCliente.pagos
                                    ? selectedCliente.pagos.reduce((sum, pago) => {
                                        const efectivo = parseFloat(pago.efectivo) || 0
                                        const transferencia = parseFloat(pago.transferencia) || 0
                                        return sum + efectivo + transferencia
                                    }, 0)
                                    : 0
                                const totalACobrar = selectedCliente.cuentaCorriente || 0

                                return (
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
                                )
                            })()}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Monto Total
                                </label>
                                <input
                                    type="number"
                                    value={pagoData.monto}
                                    onChange={(e) => setPagoData({ ...pagoData, monto: e.target.value })}
                                    className="input-field"
                                    step="0.01"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Efectivo
                                    </label>
                                    <input
                                        type="number"
                                        value={pagoData.efectivo}
                                        onChange={(e) =>
                                            setPagoData({ ...pagoData, efectivo: e.target.value })
                                        }
                                        onFocus={(e) => {
                                            if (e.target.value === '0' || e.target.value === '') {
                                                e.target.value = ''
                                                setPagoData({ ...pagoData, efectivo: '' })
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
                                        value={pagoData.transferencia}
                                        onChange={(e) =>
                                            setPagoData({ ...pagoData, transferencia: e.target.value })
                                        }
                                        onFocus={(e) => {
                                            if (e.target.value === '0' || e.target.value === '') {
                                                e.target.value = ''
                                                setPagoData({ ...pagoData, transferencia: '' })
                                            }
                                        }}
                                        className="input-field"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                            {(() => {
                                const totalACobrar = selectedCliente.cuentaCorriente || 0
                                const efectivo = parseFloat(pagoData.efectivo || 0)
                                const transferencia = parseFloat(pagoData.transferencia || 0)
                                const totalPagado = efectivo + transferencia
                                const restante = totalACobrar - totalPagado

                                return (
                                    <div className="bg-slate-700 p-3 rounded-lg">
                                        <div className="text-center font-semibold text-red-400">
                                            Restante: ${restante.toLocaleString()}
                                        </div>
                                    </div>
                                )
                            })()}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Observaciones de Transferencia
                                </label>
                                <textarea
                                    value={pagoData.observaciones}
                                    onChange={(e) =>
                                        setPagoData({ ...pagoData, observaciones: e.target.value })
                                    }
                                    className="input-field"
                                    rows="3"
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={savePago} className="btn-primary w-full sm:flex-1">
                                    Cobrar
                                </button>
                                <button
                                    onClick={() => setShowPagoModal(false)}
                                    className="btn-secondary w-full sm:flex-1"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Nuevo Pedido / Editar Pedidos */}
            {showNuevoPedidoModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {clienteParaPedido ? `Editar Pedidos - ${clienteParaPedido.nombre}` : 'Nuevo Pedido'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Cliente
                                </label>
                                <select
                                    value={pedidoFormData.clienteId}
                                    onChange={(e) => {
                                        const clienteSeleccionado = clientes.find(c => c._id === e.target.value)
                                        setClienteParaPedido(clienteSeleccionado || null)
                                        setPedidoFormData({ ...pedidoFormData, clienteId: e.target.value })
                                    }}
                                    className="input-field"
                                    disabled={!!clienteParaPedido}
                                >
                                    <option value="">Seleccionar cliente</option>
                                    {clientes.map((cliente) => (
                                        <option key={cliente._id} value={cliente._id}>
                                            #{cliente.numero} - {cliente.nombre}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Agregar Producto</h4>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-2">
                                    <ProductCombobox
                                        products={productos}
                                        value={selectedProducto || ''}
                                        onChange={(id) => setSelectedProducto(id)}
                                        placeholder="Seleccionar producto"
                                        className="input-field w-full sm:flex-1"
                                    />
                                    <div className="flex w-full sm:w-auto items-center border border-slate-600 rounded h-10">
                                        <button
                                            onClick={() => setCantidad(Math.max(1, (parseInt(cantidad) || 1) - 1))}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                            type="button"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={cantidad}
                                            onChange={(e) => setCantidad(e.target.value)}
                                            className="flex-1 sm:flex-none sm:w-12 h-10 text-center text-white bg-transparent border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            min="1"
                                        />
                                        <button
                                            onClick={() => setCantidad((parseInt(cantidad) || 1) + 1)}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
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
                                    <button onClick={addItemToPedido} className="btn-primary w-full sm:w-auto">
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Items del Pedido</h4>
                                {pedidoFormData.items.length === 0 ? (
                                    <p className="text-slate-400 text-sm">No hay items agregados</p>
                                ) : (
                                    <div className="space-y-2">
                                        {pedidoFormData.items.map((item, idx) => (
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
                                                    <div className="flex items-center border border-slate-600 rounded h-10">
                                                        <button
                                                            onClick={() => updateItemQuantityPedido(idx, item.cantidad - 1)}
                                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.cantidad}
                                                            onChange={(e) => updateItemQuantityPedido(idx, e.target.value)}
                                                            min="1"
                                                            className="w-12 h-10 text-center text-white bg-slate-700 border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <button
                                                            onClick={() => updateItemQuantityPedido(idx, item.cantidad + 1)}
                                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItemFromPedido(idx)}
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
                                    <span className="font-bold">${calcularTotalPedido().toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={saveNuevoPedido} className="btn-primary w-full sm:flex-1">
                                    Guardar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowNuevoPedidoModal(false)
                                        setClienteParaPedido(null)
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

            {/* Modal de Editar Pedidos del Cliente */}
            {showEditPedidosClienteModal && clienteEditandoPedidos && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Editar Pedidos - {clienteEditandoPedidos.nombre}
                        </h3>

                        <div className="space-y-4">
                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Agregar Producto</h4>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-2">
                                    <ProductCombobox
                                        products={productos}
                                        value={selectedProductoEdit || ''}
                                        onChange={(id) => setSelectedProductoEdit(id)}
                                        placeholder="Seleccionar producto"
                                        className="input-field w-full sm:flex-1"
                                    />
                                    <div className="flex w-full sm:w-auto items-center border border-slate-600 rounded h-10">
                                        <button
                                            onClick={() => setCantidadEdit(Math.max(1, (parseInt(cantidadEdit) || 1) - 1))}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                            type="button"
                                        >
                                            -
                                        </button>
                                        <input
                                            type="number"
                                            value={cantidadEdit}
                                            onChange={(e) => setCantidadEdit(e.target.value)}
                                            className="flex-1 sm:flex-none sm:w-12 h-10 text-center text-white bg-transparent border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            min="1"
                                        />
                                        <button
                                            onClick={() => setCantidadEdit((parseInt(cantidadEdit) || 1) + 1)}
                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                            type="button"
                                        >
                                            +
                                        </button>
                                    </div>
                                    <input
                                        type="number"
                                        value={precioPersonalizadoEdit}
                                        onChange={(e) => setPrecioPersonalizadoEdit(e.target.value)}
                                        placeholder="Editar Precio"
                                        className="input-field w-full sm:w-36"
                                        step="0.01"
                                    />
                                    <button onClick={addItemToEditPedidos} className="btn-primary w-full sm:w-auto">
                                        Agregar
                                    </button>
                                </div>
                            </div>

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Items del Pedido</h4>
                                {editPedidosFormData.items.length === 0 ? (
                                    <p className="text-slate-400 text-sm">No hay items agregados</p>
                                ) : (
                                    <div className="space-y-2">
                                        {editPedidosFormData.items.map((item, idx) => (
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
                                                    <div className="flex items-center border border-slate-600 rounded h-10">
                                                        <button
                                                            onClick={() => updateItemQuantityEditPedidos(idx, item.cantidad - 1)}
                                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            -
                                                        </button>
                                                        <input
                                                            type="number"
                                                            value={item.cantidad}
                                                            onChange={(e) => updateItemQuantityEditPedidos(idx, e.target.value)}
                                                            min="1"
                                                            className="w-12 h-10 text-center text-white bg-slate-700 border-0 focus:outline-none focus:ring-0 leading-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                        />
                                                        <button
                                                            onClick={() => updateItemQuantityEditPedidos(idx, item.cantidad + 1)}
                                                            className="w-10 h-10 flex items-center justify-center text-white hover:bg-slate-600 transition-colors"
                                                            type="button"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => removeItemFromEditPedidos(idx)}
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
                                    <span className="font-bold">${calcularTotalEditPedidos().toLocaleString()}</span>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={saveEditPedidosCliente} className="btn-primary w-full sm:flex-1">
                                    Guardar
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditPedidosClienteModal(false)
                                        setClienteEditandoPedidos(null)
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

            {/* Modal de Cobro de Pedido */}
            {showCobroModal && pedidoACobrar && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Cobrar Pedido - {clienteParaPedido?.nombre || 'Cliente'}
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
                                <button onClick={confirmarCobroCliente} className="btn-primary w-full sm:flex-1">
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

export default Clientes



