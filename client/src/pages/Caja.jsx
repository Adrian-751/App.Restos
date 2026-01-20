import { useState, useEffect } from 'react'
import api from '../utils/api'

const Caja = () => {
    const [montoInicial, setMontoInicial] = useState('')
    const [caja, setCaja] = useState(null)

    // Calcular resumen desde caja
    const resumen = caja ? {
        totalEfectivo: caja.totalEfectivo || 0,
        totalTransferencia: caja.totalTransferencia || 0,
        totalMontoInicial: caja.montoInicial || 0,
        total: (caja.totalEfectivo || 0) + (caja.totalTransferencia || 0) + (caja.montoInicial || 0),
    } : null

    const fetchCaja = async () => {
        try {
            const res = await api.get('/caja/estado')
            setCaja(res.data)
        } catch (error) {
            console.error('Error fetching caja:', error)
        }
    }

    useEffect(() => {
        fetchCaja()
        
        // Escuchar eventos de actualización de caja
        const handleCajaUpdate = () => {
            fetchCaja()
        }
        window.addEventListener('caja-updated', handleCajaUpdate)

        // Refrescar cada 5 segundos para mantener los datos actualizados
        const interval = setInterval(() => {
            fetchCaja()
        }, 5000)

        return () => {
            window.removeEventListener('caja-updated', handleCajaUpdate)
            clearInterval(interval)
        }
    }, [])

    const abrirCaja = async () => {
        if (!montoInicial || parseFloat(montoInicial) < 0) {
            alert('Por favor ingrese un monto inicial válido')
            return
        }
        try {
            await api.post('/caja/abrir', { montoInicial: parseFloat(montoInicial) || 0 })
            setMontoInicial('')
            fetchCaja()
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al abrir la caja'
            alert(`Error al abrir la caja: ${mensaje}`)
        }
    }

    const cerrarCaja = async () => {
        if (!window.confirm('¿Está seguro de cerrar la caja?')) return
        try {
            await api.post('/caja/cerrar', { id: caja._id })
            fetchCaja()
            alert('Caja cerrada correctamente')
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al cerrar la caja'
            alert(errorMsg)
        }
    }

    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-bold text-white mb-6">Gestión de Caja</h2>

            {!caja ? (
                <div className="card max-w-md mx-auto">
                    <h3 className="text-xl font-bold text-white mb-4">Abrir Caja</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Monto Inicial
                            </label>
                            <input
                                type="number"
                                value={montoInicial}
                                onChange={(e) => setMontoInicial(e.target.value)}
                                placeholder="0.00"
                                className="input-field"
                            />
                        </div>
                        <button onClick={abrirCaja} className="btn-primary w-full">
                            Abrir Caja
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="card bg-gradient-to-br from-green-600 to-green-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-white">Caja Abierta</h3>
                            <button onClick={cerrarCaja} className="btn-secondary">
                                Cerrar Caja
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-green-200 text-sm">Monto Inicial</p>
                                <p className="text-2xl font-bold text-white">
                                    ${caja.montoInicial.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-green-200 text-sm">Fecha</p>
                                <p className="text-lg font-semibold text-white">{caja.fecha}</p>
                            </div>
                        </div>
                    </div>

                    {resumen && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="card bg-gradient-to-br from-blue-600 to-blue-800">
                                <p className="text-blue-200 text-sm mb-2">Efectivo</p>
                                <p className="text-3xl font-bold text-white">
                                    ${resumen.totalEfectivo.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-purple-600 to-purple-800">
                                <p className="text-purple-200 text-sm mb-2">Transferencia</p>
                                <p className="text-3xl font-bold text-white">
                                    ${resumen.totalTransferencia.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-fuxia-primary to-fuxia-dark">
                                <p className="text-fuxia-light text-sm mb-2">Total</p>
                                <p className="text-3xl font-bold text-white">
                                    ${resumen.total.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default Caja



