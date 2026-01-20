# 📝 Ejemplo: Actualizar Componente Sin Cambiar UI

Este documento muestra cómo actualizar un componente completo (Mesas.jsx) 
para usar todas las mejoras de backend SIN cambiar la interfaz visual.

---

## 🔄 ANTES vs DESPUÉS: Mesas.jsx

### ❌ ANTES (Código Original)

```javascript
import { useEffect, useState } from 'react'
import axios from 'axios'

const Mesas = () => {
    const [mesas, setMesas] = useState([])
    const [showModal, setShowModal] = useState(false)
    const [editingMesa, setEditingMesa] = useState(null)
    const [formData, setFormData] = useState({ numero: '', nombre: '', color: '#e11d48' })

    useEffect(() => {
        fetchMesas()
    }, [])

    const fetchMesas = async () => {
        try {
            const res = await axios.get('/api/mesas')
            setMesas(res.data)
        } catch (error) {
            console.error('Error fetching mesas:', error)
        }
    }

    const handleDragStart = (e, mesa) => {
        e.dataTransfer.setData('mesaId', mesa.id)
    }

    const handleDrop = async (e) => {
        e.preventDefault()
        const mesaId = e.dataTransfer.getData('mesaId')
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        try {
            await axios.put(`/api/mesas/${mesaId}`, { x, y })
            fetchMesas()
        } catch (error) {
            console.error('Error updating mesa position:', error)
        }
    }

    // ... resto del código
}
```

---

### ✅ DESPUÉS (Con todas las mejoras)

```javascript
import { useState } from 'react'
import api from '../utils/api'  // ✅ Cambio 1: Usar api en lugar de axios
import { useAsync } from '../hooks/useAsync'  // ✅ Cambio 2: Hook para estados de carga
import Modal from '../components/Modal'  // ✅ Cambio 3: Componente reutilizable

const Mesas = () => {
    // ✅ Cambio 4: Usar hook useAsync para manejar carga y errores
    const { data: mesas = [], loading, error, refetch } = useAsync(
        () => api.get('/mesas').then(res => res.data),
        []
    )

    // ✅ Cambio 5: Usar hook useModal para manejar modales
    const { isOpen, editingItem, openModal, closeModal } = useModal()
    
    const [formData, setFormData] = useState({ 
        numero: '', 
        nombre: '', 
        color: '#e11d48' 
    })

    // ✅ Cambio 6: Función mejorada con manejo de errores
    const handleDrop = async (e) => {
        e.preventDefault()
        const mesaId = e.dataTransfer.getData('mesaId')
        const rect = e.currentTarget.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top

        try {
            await api.put(`/mesas/${mesaId}`, { x, y })
            refetch() // ✅ Actualizar datos
        } catch (error) {
            // ✅ Mostrar error al usuario (opcional)
            alert(`Error: ${error.response?.data?.error || error.message}`)
        }
    }

    // ✅ Cambio 7: Función mejorada para abrir modal
    const openEditModal = (mesa = null) => {
        if (mesa) {
            setFormData({ 
                numero: mesa.numero, 
                nombre: mesa.nombre, 
                color: mesa.color 
            })
        } else {
            setFormData({ 
                numero: '', 
                nombre: '', 
                color: '#e11d48' 
            })
        }
        openModal(mesa)
    }

    // ✅ Cambio 8: Función mejorada para guardar
    const saveMesa = async () => {
        try {
            if (editingItem) {
                await api.put(`/mesas/${editingItem._id}`, formData)
            } else {
                await api.post('/mesas', formData)
            }
            closeModal()
            refetch() // ✅ Actualizar lista
        } catch (error) {
            // ✅ Mostrar error específico del servidor
            const errorMsg = error.response?.data?.error || 
                           error.response?.data?.errors?.[0]?.msg || 
                           'Error al guardar la mesa'
            alert(errorMsg)
        }
    }

    // ✅ Cambio 9: Función mejorada para eliminar
    const deleteMesa = async (id) => {
        if (!window.confirm('¿Eliminar esta mesa?')) return
        
        try {
            await api.delete(`/mesas/${id}`)
            refetch()
        } catch (error) {
            alert(`Error: ${error.response?.data?.error || error.message}`)
        }
    }

    // ✅ Cambio 10: Mostrar estados de carga y error
    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-white">Mapa de Mesas</h2>
                    <button className="btn-primary" disabled>
                        + Nueva Mesa
                    </button>
                </div>
                <div className="card relative min-h-[600px] bg-slate-900 flex items-center justify-center">
                    <div className="text-white text-xl">Cargando mesas...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-white">Mapa de Mesas</h2>
                    <button className="btn-primary" onClick={refetch}>
                        Reintentar
                    </button>
                </div>
                <div className="card bg-red-900 border border-red-700">
                    <div className="text-red-200 p-4">
                        <p className="font-bold mb-2">Error al cargar mesas:</p>
                        <p>{error.message}</p>
                    </div>
                </div>
            </div>
        )
    }

    // ✅ El resto del JSX se mantiene IGUAL
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold text-white">Mapa de Mesas</h2>
                <button onClick={() => openEditModal()} className="btn-primary">
                    + Nueva Mesa
                </button>
            </div>

            <div
                className="card relative min-h-[600px] bg-slate-900"
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
            >
                {mesas.map((mesa) => (
                    <div
                        key={mesa._id}  // ✅ Cambio: usar _id en lugar de id
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('mesaId', mesa._id)
                        }}
                        style={{
                            left: `${mesa.x}px`,
                            top: `${mesa.y}px`,
                            position: 'absolute',
                        }}
                        className="cursor-move group"
                    >
                        <div
                            className="w-20 h-20 rounded-lg shadow-lg flex flex-col items-center justify-center text-white font-bold transition-transform hover:scale-110"
                            style={{ 
                                backgroundColor: mesa.color, 
                                opacity: mesa.estado === 'ocupada' ? 0.8 : mesa.estado === 'reservada' ? 0.9 : 1 
                            }}
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

            {/* ✅ Cambio 11: Usar componente Modal reutilizable */}
            <Modal
                isOpen={isOpen}
                onClose={closeModal}
                title={editingItem ? 'Editar Mesa' : 'Nueva Mesa'}
            >
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
                        {editingItem && (
                            <button 
                                onClick={async () => {
                                    try {
                                        await api.put(`/mesas/${editingItem._id}`, {
                                            ...formData,
                                            estado: 'reservada'
                                        })
                                        closeModal()
                                        refetch()
                                        window.dispatchEvent(new Event('mesa-updated'))
                                    } catch (error) {
                                        alert(`Error: ${error.response?.data?.error || error.message}`)
                                    }
                                }} 
                                className="btn-primary flex-1"
                            >
                                Reservar
                            </button>
                        )}
                        <button onClick={closeModal} className="btn-secondary flex-1">
                            Cancelar
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}

export default Mesas
```

---

## 📋 Resumen de Cambios

### ✅ Lo que CAMBIÓ (Backend/Interno):
1. ✅ `axios` → `api` (con autenticación automática)
2. ✅ `useState` + `useEffect` → `useAsync` (manejo de estados)
3. ✅ Manejo de errores mejorado
4. ✅ IDs: `id` → `_id` (MongoDB)
5. ✅ Componentes reutilizables (Modal, hooks)

### ✅ Lo que NO CAMBIÓ (UI/Visual):
1. ✅ Mismos botones
2. ✅ Mismos modales
3. ✅ Mismo diseño
4. ✅ Misma funcionalidad visual
5. ✅ Misma experiencia de usuario

---

## 🎯 Pasos para Actualizar Cualquier Componente

1. **Reemplazar imports:**
   ```javascript
   // Antes
   import axios from 'axios'
   
   // Después
   import api from '../utils/api'
   ```

2. **Reemplazar useState + useEffect por useAsync:**
   ```javascript
   // Antes
   const [data, setData] = useState([])
   useEffect(() => { fetchData() }, [])
   
   // Después
   const { data, loading, error, refetch } = useAsync(
       () => api.get('/ruta').then(res => res.data),
       []
   )
   ```

3. **Actualizar IDs:**
   ```javascript
   // Antes
   mesa.id
   
   // Después
   mesa._id
   ```

4. **Mejorar manejo de errores:**
   ```javascript
   // Antes
   catch (error) {
       console.error(error)
   }
   
   // Después
   catch (error) {
       const errorMsg = error.response?.data?.error || error.message
       alert(errorMsg)
   }
   ```

5. **Agregar estados de carga:**
   ```javascript
   if (loading) return <div>Cargando...</div>
   if (error) return <div>Error: {error.message}</div>
   ```

---

## 🧪 Cómo Probar

1. **Inicia el servidor:**
   ```bash
   cd server
   npm run dev
   ```

2. **Inicia el cliente:**
   ```bash
   cd client
   npm run dev
   ```

3. **Prueba la autenticación:**
   - Primero registra un usuario
   - Luego inicia sesión
   - El token se guarda automáticamente

4. **Prueba las funcionalidades:**
   - Crear mesa
   - Editar mesa
   - Eliminar mesa
   - Arrastrar mesa

---

¡Listo! Ahora tienes un componente completamente actualizado con todas las mejoras de backend, pero con la misma UI. 🚀

