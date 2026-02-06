import { useEffect, useState } from 'react'
import api from '../utils/api'
import { useLockBodyScroll } from '../hooks/useLockBodyScroll'

const Productos = () => {
    const [productos, setProductos] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingProducto, setEditingProducto] = useState(null)
    const [formData, setFormData] = useState({
        numero: '',
        nombre: '',
        precio: '',
        stock: '',
        cantidadDisponible: '',
        categoria: 'general',
    })

    useLockBodyScroll(!!showModal)

    const openEditModal = (producto = null) => {
        if (producto) {
            setFormData({
                numero: producto.numero,
                nombre: producto.nombre,
                precio: producto.precio,
                stock: producto.stock,
                cantidadDisponible: producto.cantidadDisponible,
                categoria: producto.categoria || 'general',
            })
        } else {
            setFormData({
                numero: '',
                nombre: '',
                precio: '',
                stock: '',
                cantidadDisponible: '',
                categoria: 'general',
            })
        }
        setEditingProducto(producto)
        setShowModal(true)
    }

    useEffect(() => {
        fetchProductos()
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
                ...formData,
                precio: parseFloat(formData.precio) || 0,
                stock: parseInt(formData.stock) || 0,
                cantidadDisponible: parseInt(formData.cantidadDisponible || formData.stock) || 0,
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
            alert(errorMsg)
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
            alert(errorMsg)
        }
    }

    const deleteProducto = async (id) => {
        if (!window.confirm('¿Eliminar este producto?')) return
        try {
            await api.delete(`/productos/${id}`)
            fetchProductos()
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al eliminar el producto'
            alert(errorMsg)
        }
    }


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-2xl sm:text-3xl font-bold text-white">Productos</h2>
                <button onClick={() => openEditModal()} className="btn-primary w-full sm:w-auto">
                    + Nuevo Producto
                </button>
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
                                    Stock
                                </label>
                                <input
                                    type="number"
                                    value={formData.stock}
                                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                                    className="input-field"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Cantidad Disponible
                                </label>
                                <input
                                    type="number"
                                    value={formData.cantidadDisponible}
                                    onChange={(e) =>
                                        setFormData({ ...formData, cantidadDisponible: e.target.value })
                                    }
                                    className="input-field"
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



