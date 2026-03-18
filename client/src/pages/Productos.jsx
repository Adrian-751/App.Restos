import { useEffect, useState } from 'react'
import api from '../utils/api'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'
import { toastError } from '../utils/toast'
import { useModalHotkeys } from '../hooks/useModalHotkeys'

const Productos = () => {
    const [productos, setProductos] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingProducto, setEditingProducto] = useState(null)
    const [formData, setFormData] = useState({
        numero: '',
        nombre: '',
        costo: '',
        precio: '',
        categoria: 'general',
    })
    const [showInventario, setShowInventario] = useState(false)
    const [lotes, setLotes] = useState([])
    const [loteForm, setLoteForm] = useState({ productoId: '', cantidad: '', observaciones: '' })
    const [showLoteForm, setShowLoteForm] = useState(false)

    useLockBodyScroll(!!showModal || !!showInventario)

    const openEditModal = (producto = null) => {
        if (producto) {
            setFormData({
                numero: producto.numero,
                nombre: producto.nombre,
                costo: producto.costo || '',
                precio: producto.precio,
                categoria: producto.categoria || 'general',
            })
        } else {
            setFormData({
                numero: '',
                nombre: '',
                costo: '',
                precio: '',
                categoria: 'general',
            })
        }
        setEditingProducto(producto)
        setShowModal(true)
    }

    useEffect(() => {
        fetchProductos()
        fetchLotes()
    }, [])

    const fetchProductos = async () => {
        try {
            const res = await api.get('/productos')
            setProductos(res.data)
        } catch (error) {
            console.error('Error fetching productos:', error)
        }
    }

    const saveProducto = async () => {
        try {
            const data = {
                numero: formData.numero,
                nombre: formData.nombre,
                costo: parseFloat(formData.costo) || 0,
                precio: parseFloat(formData.precio) || 0,
                categoria: formData.categoria,
            }

            if (editingProducto) {
                await api.put(`/productos/${editingProducto._id}`, data)
            } else {
                await api.post('/productos', data)
            }
            setShowModal(false)
            setEditingProducto(null)
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error ||
                error.response?.data?.errors?.[0]?.msg ||
                'Error al guardar el producto'
            toastError(errorMsg)
        }
    }

    const updateStock = async (id, nuevoStock) => {
        try {
            await api.put(`/productos/${id}`, {
                stock: nuevoStock,
                cantidadDisponible: nuevoStock,
            })
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al actualizar el stock'
            toastError(errorMsg)
        }
    }

    const deleteProducto = async (id) => {
        if (!window.confirm('¿Eliminar este producto?')) return
        try {
            await api.delete(`/productos/${id}`)
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al eliminar el producto'
            toastError(errorMsg)
        }
    }

    const fetchLotes = async () => {
        try {
            const res = await api.get('/lotes')
            setLotes(res.data)
        } catch (error) {
            console.error('Error fetching lotes:', error)
        }
    }

    const saveLote = async () => {
        try {
            await api.post('/lotes', {
                productoId: loteForm.productoId,
                cantidad: parseInt(loteForm.cantidad) || 0,
                observaciones: loteForm.observaciones,
            })
            setLoteForm({ productoId: '', cantidad: '', observaciones: '' })
            setShowLoteForm(false)
            fetchLotes()
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Error al agregar el lote'
            toastError(errorMsg)
        }
    }

    const calcLoteActivo = (producto) => {
        const lotesProducto = lotes
            .filter(l => l.productoId === producto._id)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        if (lotesProducto.length === 0) return null
        const consumed = (producto.stock || 0) - (producto.cantidadDisponible || 0)
        let accum = 0
        for (let i = 0; i < lotesProducto.length; i++) {
            accum += lotesProducto[i].cantidad
            if (consumed < accum) return i + 1
        }
        return lotesProducto.length
    }

    const deleteLote = async (id) => {
        if (!window.confirm('¿Eliminar este lote? El stock del producto se reducirá.')) return
        try {
            await api.delete(`/lotes/${id}`)
            fetchLotes()
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Error al eliminar el lote'
            toastError(errorMsg)
        }
    }

    // Hotkeys modal: ESC = cancelar, ENTER = guardar
    useModalHotkeys({
        isOpen: showModal,
        onCancel: () => { setShowModal(false); setEditingProducto(null) },
        onConfirm: saveProducto,
    })


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Productos</h2>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => { setShowInventario(true) }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg transition-colors w-full sm:w-auto"
                    >
                        + Inventario
                    </button>
                    <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                        + Nuevo Producto
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {productos.map((producto) => (
                    <div key={producto._id} className="card">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-white">#{producto.numero}</h3>
                                <p className="text-xl text-white">{producto.nombre}</p>
                            </div>
                            <span className="px-2 py-1 bg-slate-700 rounded text-xs text-slate-300">
                                {producto.categoria}
                            </span>
                        </div>

                        <div className="space-y-2 mb-4">
                            {producto.costo > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-400">Costo:</span>
                                    <span className="text-slate-300 font-semibold">
                                        ${producto.costo?.toLocaleString()}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Precio:</span>
                                <span className="text-white font-semibold">
                                    ${producto.precio?.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-slate-400">Stock:</span>
                                <span
                                    className={`font-semibold ${producto.cantidadDisponible > 0 ? 'text-green-400' : 'text-red-400'
                                        }`}
                                >
                                    {producto.cantidadDisponible || 0} / {producto.stock || 0}
                                </span>
                            </div>
                            {(() => {
                                const loteNum = calcLoteActivo(producto)
                                if (!loteNum) return null
                                return (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-400">Lote abierto:</span>
                                        <span className="text-emerald-400 font-semibold">#{loteNum}</span>
                                    </div>
                                )
                            })()}
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <button
                                onClick={() => {
                                    const nuevoStock = prompt(
                                        'Ingrese nuevo stock:',
                                        producto.stock || 0
                                    )
                                    if (nuevoStock !== null) {
                                        updateStock(producto._id, parseInt(nuevoStock))
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:flex-1 px-3 py-2 rounded-lg text-sm"
                            >
                                Editar Stock
                            </button>
                            <button
                                onClick={() => openEditModal(producto)}
                                className="btn-secondary text-sm w-full sm:w-auto px-3"
                            >
                                ✏️
                            </button>
                            <button
                                onClick={() => deleteProducto(producto._id)}
                                className="bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto px-3 py-2 rounded-lg text-sm"
                            >
                                🗑️
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Inventario */}
            {showInventario && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-2xl w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Inventario</h3>
                            <button
                                onClick={() => { setShowInventario(false); setShowLoteForm(false); setLoteForm({ productoId: '', cantidad: '', observaciones: '' }) }}
                                className="text-slate-400 hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {/* Formulario agregar lote */}
                        {showLoteForm ? (
                            <div className="bg-slate-700 rounded-lg p-4 mb-4 space-y-3">
                                <h4 className="text-sm font-semibold text-slate-200">Agregar lote a: <span className="text-emerald-400">{productos.find(p => p._id === loteForm.productoId)?.nombre}</span></h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">Cantidad</label>
                                        <input
                                            type="number"
                                            value={loteForm.cantidad}
                                            onChange={(e) => setLoteForm({ ...loteForm, cantidad: e.target.value })}
                                            className="input-field"
                                            min="1"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1">Observaciones (opcional)</label>
                                        <input
                                            type="text"
                                            value={loteForm.observaciones}
                                            onChange={(e) => setLoteForm({ ...loteForm, observaciones: e.target.value })}
                                            className="input-field"
                                            placeholder="Ej: Compra 15/03"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={saveLote} className="btn-primary flex-1">Guardar Lote</button>
                                    <button onClick={() => { setShowLoteForm(false); setLoteForm({ productoId: '', cantidad: '', observaciones: '' }) }} className="btn-secondary flex-1">Cancelar</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-slate-400 text-sm mb-4">Seleccioná un producto para agregar un lote de stock.</p>
                        )}

                        {/* Lista de productos con sus lotes */}
                        <div className="space-y-3">
                            {productos.map((producto) => {
                                const lotesProducto = lotes
                                    .filter(l => l.productoId === producto._id)
                                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                                    .map((lote, idx) => ({ ...lote, numero: idx + 1 }))
                                const loteActivoNum = calcLoteActivo(producto)
                                return (
                                    <div key={producto._id} className="bg-slate-700 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <div>
                                                <span className="text-white font-medium">#{producto.numero} {producto.nombre}</span>
                                                <div className="flex gap-3 mt-0.5">
                                                    <span className="text-xs text-slate-400">
                                                        Stock: <span className={producto.cantidadDisponible > 0 ? 'text-green-400' : 'text-red-400'}>
                                                            {producto.cantidadDisponible || 0} / {producto.stock || 0}
                                                        </span>
                                                    </span>
                                                    {loteActivoNum && (
                                                        <span className="text-xs text-slate-400">
                                                            Lote abierto: <span className="text-emerald-400 font-semibold">#{loteActivoNum}</span>
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { setLoteForm({ productoId: producto._id, cantidad: '', observaciones: '' }); setShowLoteForm(true) }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1 rounded-lg"
                                            >
                                                + Lote
                                            </button>
                                        </div>
                                        {lotesProducto.length > 0 && (
                                            <div className="space-y-1 mt-2 border-t border-slate-600 pt-2">
                                                {lotesProducto.map((lote) => (
                                                    <div key={lote._id} className="flex items-center justify-between text-xs py-0.5">
                                                        <span className="text-slate-300 flex items-center gap-2">
                                                            <span className={`font-bold ${lote.numero === loteActivoNum ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                                Lote #{lote.numero}
                                                            </span>
                                                            <span className="text-white">Cantidad: {lote.cantidad}</span>
                                                            {lote.observaciones && <span className="text-slate-400">— {lote.observaciones}</span>}
                                                            <span className="text-slate-500">{new Date(lote.createdAt).toLocaleDateString('es-AR')}</span>
                                                        </span>
                                                        <button onClick={() => deleteLote(lote._id)} className="text-red-400 hover:text-red-300 ml-2 shrink-0">🗑️</button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Producto */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 z-[60] p-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] overflow-y-auto overscroll-contain flex items-start sm:items-center justify-center">
                    <div className="card bg-slate-800 max-w-md w-full max-h-[calc(100dvh-2rem)] sm:max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-white mb-4">
                            {editingProducto ? 'Editar Producto' : 'Nuevo Producto'}
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
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Costo
                                </label>
                                <input
                                    type="number"
                                    value={formData.costo}
                                    onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                                    className="input-field"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Precio de Venta
                                </label>
                                <input
                                    type="number"
                                    value={formData.precio}
                                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                                    className="input-field"
                                    step="0.01"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Categoría
                                </label>
                                <select
                                    value={formData.categoria}
                                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                                    className="input-field"
                                >
                                    <option value="general">General</option>
                                    <option value="Bebida">Bebida</option>
                                    <option value="Comida">Comida</option>
                                    <option value="Postre">Postre</option>
                                </select>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3">
                                <button onClick={saveProducto} className="btn-primary w-full sm:flex-1">
                                    Guardar
                                </button>
                                <button
                                    onClick={() => { setShowModal(false); setEditingProducto(null) }}
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

export default Productos



