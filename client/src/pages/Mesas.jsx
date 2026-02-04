import { useEffect, useRef, useState } from 'react'
import api from '../utils/api'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'

const Mesas = () => {
    const [mesas, setMesas] = useState([])
    const [productos, setProductos] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingMesa, setEditingMesa] = useState(null)
    const [formData, setFormData] = useState({ numero: '', nombre: '', color: '#e11d48' })

    useEffect(() => {
        fetchMesas()
        fetchProductos()
    }, [])

    const fetchMesas = async () => {
        try {
            const res = await api.get('/mesas')
            setMesas(res.data)
        } catch (error) {
            console.error('Error fetching mesas:', error)
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

    // Estados para el modal de nuevo pedido
    const [showPedidoModal, setShowPedidoModal] = useState(false)
    const [pedidoFormData, setPedidoFormData] = useState({
        mesaId: '',
        items: [],
    })
    const [selectedProducto, setSelectedProducto] = useState(null)
    const [cantidad, setCantidad] = useState(1)
    const [precioPersonalizado, setPrecioPersonalizado] = useState('')

    // Drag táctil / pointer (móvil + desktop)
    const mapRef = useRef(null)
    const draggingRef = useRef(null) // { mesaId, offsetX, offsetY }
    const pendingDragRef = useRef(null) // { mesa, startX, startY, timerId, pointerId }
    const isDraggingRef = useRef(false)

    useLockBodyScroll(!!showModal || !!showPedidoModal)

    const handleDragStart = (e, mesa) => {
        if (!mesa || !mesa._id) {
            e.preventDefault()
            return
        }
        e.dataTransfer.setData('mesaId', mesa._id)
        e.dataTransfer.effectAllowed = 'move'
    }

    const cancelPendingDrag = () => {
        const pending = pendingDragRef.current
        if (!pending) return
        if (pending.timerId) clearTimeout(pending.timerId)
        pendingDragRef.current = null
    }

    const startPointerDrag = (e, mesa) => {
        if (!mesa || !mesa._id) return

        // IMPORTANTE:
        // - No hacemos preventDefault acá para permitir scroll vertical en mobile.
        // - Activamos drag con un "press & hold" corto (evita que el mapa bloquee el scroll).
        const clientX = e.clientX
        const clientY = e.clientY
        if (typeof clientX !== 'number' || typeof clientY !== 'number') return

        cancelPendingDrag()

        const pointerId = e.pointerId
        const timerId = setTimeout(() => {
            const container = mapRef.current
            if (!container) return
            const rect = container.getBoundingClientRect()

            const pointerX = clientX - rect.left
            const pointerY = clientY - rect.top

            draggingRef.current = {
                mesaId: mesa._id,
                offsetX: pointerX - (mesa.x || 0),
                offsetY: pointerY - (mesa.y || 0),
            }
            isDraggingRef.current = true

            // Capturar el pointer para recibir movimientos aunque salga del elemento
            try {
                e.currentTarget.setPointerCapture?.(pointerId)
            } catch {
                // ignore
            }
        }, 180)

        pendingDragRef.current = { mesa, startX: clientX, startY: clientY, timerId, pointerId }
    }

    const movePointerDrag = (e) => {
        // Si todavía no entramos en modo drag, si el usuario se mueve "para scrollear",
        // cancelamos el drag pendiente y dejamos que el navegador haga scroll normal.
        if (!isDraggingRef.current && pendingDragRef.current) {
            const pending = pendingDragRef.current
            const dx = Math.abs((e.clientX || 0) - pending.startX)
            const dy = Math.abs((e.clientY || 0) - pending.startY)
            if (dx + dy > 8) {
                cancelPendingDrag()
            }
            return
        }

        const drag = draggingRef.current
        if (!drag) return

        // En drag activo, bloqueamos scroll/gestos
        e.preventDefault()
        e.stopPropagation()

        const container = mapRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()

        const clientX = e.clientX ?? (e.touches?.[0]?.clientX)
        const clientY = e.clientY ?? (e.touches?.[0]?.clientY)
        if (typeof clientX !== 'number' || typeof clientY !== 'number') return

        const x = clientX - rect.left - drag.offsetX
        const y = clientY - rect.top - drag.offsetY

        // Actualizar en UI en tiempo real (sin esperar al backend)
        setMesas((prev) =>
            prev.map((m) => (m._id === drag.mesaId ? { ...m, x, y } : m))
        )
    }

    const endPointerDrag = async () => {
        cancelPendingDrag()
        isDraggingRef.current = false
        const drag = draggingRef.current
        if (!drag) return
        draggingRef.current = null

        const mesa = mesas.find((m) => m._id === drag.mesaId)
        if (!mesa) return

        try {
            await api.put(`/mesas/${drag.mesaId}`, { x: mesa.x, y: mesa.y })
            fetchMesas()
        } catch (error) {
            console.error('Error updating mesa position:', error)
        }
    }

    const handleDrop = async (e) => {
        e.preventDefault()
        e.stopPropagation()
        const mesaId = e.dataTransfer.getData('mesaId')
        if (!mesaId) return

        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        try {
            await api.put(`/mesas/${mesaId}`, { x, y })
            fetchMesas()
        } catch (error) {
            console.error('Error updating mesa position:', error)
            const errorMsg = error.response?.data?.error || error.message || 'Error al actualizar la posición'
            alert(errorMsg)
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        e.stopPropagation()
    }

    const openEditModal = (mesa = null) => {
        if (mesa) {
            setFormData({ numero: mesa.numero, nombre: mesa.nombre, color: mesa.color })
        } else {
            setFormData({ numero: '', nombre: '', color: '#e11d48' })
        }
        setEditingMesa(mesa)
        setShowModal(true)
    }

    const saveMesa = async () => {
        try {
            if (editingMesa) {
                await api.put(`/mesas/${editingMesa._id}`, formData)
            } else {
                await api.post('/mesas', formData)
            }
            setShowModal(false)
            setEditingMesa(null)
            fetchMesas()
        } catch (error) {
            console.error('Error saving mesa:', error)
            const errorMsg = error.response?.data?.error || error.message || 'Error al guardar la mesa'
            alert(errorMsg)
        }
    }

    const reserveMesa = async () => {
        try {
            if (editingMesa) {
                await api.put(`/mesas/${editingMesa._id}`, {
                    ...formData,
                    estado: 'reservada'
                })
            }
            setShowModal(false)
            setEditingMesa(null)
            fetchMesas()
            window.dispatchEvent(new Event('mesa-updated'))
        } catch (error) {
            console.error('Error reserving mesa:', error)
        }
    }

    const deleteMesa = async (id) => {
        if (!window.confirm('¿Eliminar esta mesa?')) return
        try {
            await api.delete(`/mesas/${id}`)
            fetchMesas()
        } catch (error) {
            console.error('Error deleting mesa:', error)
        }
    }

    // Funciones para el modal de nuevo pedido
    const openPedidoModal = (mesaId = '') => {
        setPedidoFormData({
            mesaId: mesaId,
            items: [],
        })
        setSelectedProducto(null)
        setCantidad(1)
        setPrecioPersonalizado('')
        setShowPedidoModal(true)
    }

    const addItem = () => {
        try {
            if (!selectedProducto) return
            if (!Array.isArray(productos)) return
            const producto = productos.find((p) => p && p._id === selectedProducto)
            if (!producto) return

            const precio = precioPersonalizado
                ? parseFloat(precioPersonalizado)
                : producto.precio

            const newItem = {
                productoId: producto._id,
                nombre: producto.nombre,
                cantidad: parseInt(cantidad) || 1,
                precio: precio || 0,
                precioOriginal: producto.precio || 0,
            }

            setPedidoFormData({
                ...pedidoFormData,
                items: [...(pedidoFormData.items || []), newItem],
            })
            setSelectedProducto(null)
            setCantidad(1)
            setPrecioPersonalizado('')
        } catch (error) {
            console.error('Error adding item:', error)
            alert('Error al agregar el producto')
        }
    }

    const removeItem = (index) => {
        setPedidoFormData({
            ...pedidoFormData,
            items: pedidoFormData.items.filter((_, i) => i !== index),
        })
    }

    const updateItemQuantity = (index, newCantidad) => {
        if (newCantidad < 1) return
        const updatedItems = pedidoFormData.items.map((item, i) =>
            i === index ? { ...item, cantidad: parseInt(newCantidad) } : item
        )
        setPedidoFormData({
            ...pedidoFormData,
            items: updatedItems,
        })
    }

    const calcularTotal = () => {
        if (!Array.isArray(pedidoFormData.items)) return 0
        return pedidoFormData.items.reduce((sum, item) => {
            const precio = parseFloat(item.precio) || 0
            const cantidad = parseInt(item.cantidad) || 0
            return sum + (precio * cantidad)
        }, 0)
    }

    const savePedido = async () => {
        try {
            const total = calcularTotal()
            const data = {
                ...pedidoFormData,
                total,
            }

            // Si hay una mesa seleccionada, actualizar su estado a "ocupada"
            if (pedidoFormData.mesaId) {
                try {
                    await api.put(`/mesas/${pedidoFormData.mesaId}`, {
                        estado: 'ocupada'
                    })
                    window.dispatchEvent(new Event('mesa-updated'))
                    fetchMesas()
                } catch (error) {
                    console.error('Error actualizando estado de mesa', error)
                }
            }

            await api.post('/pedidos', data)
            setShowPedidoModal(false)
            setPedidoFormData({ mesaId: '', items: [] })
            alert('Pedido creado correctamente')
        } catch (error) {
            console.error('Error saving pedido:', error)
            const errorMsg = error.response?.data?.error || error.message || 'Error al guardar el pedido'
            alert(errorMsg)
        }
    }

    const handleDoubleClick = (e, mesa) => {
        e.preventDefault()
        e.stopPropagation()
        openPedidoModal(mesa._id)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Mapa de Mesas</h2>
                <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                    + Nueva Mesa
                </button>
            </div>

            <div
                ref={mapRef}
                className="card relative min-h-[520px] sm:min-h-[600px] bg-slate-900 touch-pan-y"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onPointerMove={movePointerDrag}
                onPointerUp={endPointerDrag}
                onPointerCancel={endPointerDrag}
            >
                {mesas.map((mesa) => (
                    <div
                        key={mesa._id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, mesa)}
                        onPointerDown={(e) => startPointerDrag(e, mesa)}
                        onDoubleClick={(e) => handleDoubleClick(e, mesa)}
                        style={{
                            left: `${mesa.x}px`,
                            top: `${mesa.y}px`,
                            position: 'absolute',
                        }}
                        className="cursor-move select-none group touch-pan-y"
                    >
                        <div
                            className="w-14 h-14 rounded-lg shadow-lg flex flex-col items-center justify-center text-white font-bold transition-transform hover:scale-110"
                            style={{ backgroundColor: mesa.color, opacity: mesa.estado === 'ocupada' ? 0.8 : mesa.estado === 'reservada' ? 0.9 : 1 }}
                        >
                            <span className="text-sm">{mesa.numero}</span>
                            <span className="text-xs">{mesa.nombre}</span>
                            {mesa.estado !== 'libre' && (
                                <span className="text-xs mt-1">
                                    {mesa.estado === 'ocupada' ? '🔴' : '🟣'}
                                </span>
                            )}
                        </div>
                        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                                onClick={() => openEditModal(mesa)}
                                className="bg-blue-600 text-white rounded-full w-6 h-6 text-xs mr-1"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => deleteMesa(mesa._id)}
                                className="bg-red-600 text-white rounded-full w-6 h-6 text-xs"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Mesa */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingMesa ? 'Editar Mesa' : 'Nueva Mesa'}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Número
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
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Color
                                </label>
                                <input
                                    type="color"
                                    value={formData.color}
                                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                    className="w-full h-12 rounded-lg"
                                />
                            </div>
                            <div className="flex space-x-4">
                                <button onClick={saveMesa} className="btn-primary flex-1">
                                    Guardar
                                </button>
                                {editingMesa && (
                                    <button onClick={reserveMesa} className="btn-primary flex-1">
                                        Reservar
                                    </button>
                                )}
                                <button onClick={() => { setShowModal(false); setEditingMesa(null) }} className="btn-secondary flex-1">
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Nuevo Pedido */}
            {showPedidoModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            Nuevo Pedido
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Mesa (opcional)
                                </label>
                                <select
                                    value={pedidoFormData.mesaId}
                                    onChange={(e) => setPedidoFormData({ ...pedidoFormData, mesaId: e.target.value })}
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

                            <div className="border border-slate-700 rounded-lg p-4">
                                <h4 className="text-white font-semibold mb-3">Agregar Producto</h4>
                                <div className="flex flex-col sm:flex-row sm:items-end gap-2 mb-2">
                                    <select
                                        value={selectedProducto || ''}
                                        onChange={(e) => setSelectedProducto(e.target.value)}
                                        className="input-field w-full sm:flex-1"
                                    >
                                        <option value="">Seleccionar producto</option>
                                        {productos.map((prod) => (
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
                                                    {item.precio !== item.precioOriginal && (
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
                                    onClick={() => setShowPedidoModal(false)}
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

export default Mesas



