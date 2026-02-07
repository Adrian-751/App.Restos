import { useState, useEffect } from 'react'
import api from '../utils/api'
import { toastError, toastInfo, toastSuccess } from '../utils/toast'
import Modal from '../components/Modal'
import { useModalHotkeys } from '../hooks/useModalHotkeys'

const Caja = () => {
    const [montoInicial, setMontoInicial] = useState('')
    const [caja, setCaja] = useState(null)
    const [showCerrarConfirm, setShowCerrarConfirm] = useState(false)
    const [showEgresoModal, setShowEgresoModal] = useState(false)
    const [egresoData, setEgresoData] = useState({
        efectivo: '',
        transferencia: '',
        observaciones: '',
    })

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

        // Refrescar cada 30 segundos (y pausar si la app queda en background)
        let interval = null
        const start = () => {
            if (interval) return
            interval = setInterval(() => fetchCaja(), 30000)
        }
        const stop = () => {
            if (!interval) return
            clearInterval(interval)
            interval = null
        }

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') start()
            else stop()
        }

        onVisibilityChange()
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            window.removeEventListener('caja-updated', handleCajaUpdate)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            stop()
        }
    }, [])

    const abrirCaja = async () => {
        if (!montoInicial || parseFloat(montoInicial) < 0) {
            toastInfo('Por favor ingrese un monto inicial válido')
            return
        }
        try {
            await api.post('/caja/abrir', { montoInicial: parseFloat(montoInicial) || 0 })
            setMontoInicial('')
            fetchCaja()
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al abrir la caja'
            toastError(`Error al abrir la caja: ${mensaje}`)
        }
    }

    const cerrarCaja = async () => {
        try {
            await api.post('/caja/cerrar', { id: caja._id })
            fetchCaja()
            toastSuccess('Caja cerrada')
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || 'Error al cerrar la caja'
            toastError(errorMsg)
        }
    }

    const handleCerrarCajaClick = () => {
        setShowCerrarConfirm(true)
    }

    const handleConfirmCerrar = async () => {
        setShowCerrarConfirm(false)
        await cerrarCaja()
    }

    const registrarEgreso = async () => {
        try {
            const efectivo = parseFloat(egresoData.efectivo) || 0
            const transferencia = parseFloat(egresoData.transferencia) || 0
            const observaciones = egresoData.observaciones || ''
            await api.post('/caja/egreso', { efectivo, transferencia, observaciones })
            setShowEgresoModal(false)
            setEgresoData({ efectivo: '', transferencia: '', observaciones: '' })
            fetchCaja()
            window.dispatchEvent(new Event('caja-updated'))
            toastSuccess('Egreso registrado')
        } catch (error) {
            const msg = error.response?.data?.error || error.message || 'Error al registrar el egreso'
            toastError(msg)
        }
    }

    useModalHotkeys({
        isOpen: showCerrarConfirm,
        onCancel: () => setShowCerrarConfirm(false),
        onConfirm: handleConfirmCerrar,
    })

    useModalHotkeys({
        isOpen: showEgresoModal,
        onCancel: () => setShowEgresoModal(false),
        onConfirm: registrarEgreso,
    })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4 sm:mb-6">Gestión de Caja</h2>

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
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 className="text-lg sm:text-xl font-bold text-white">Caja Abierta</h3>
                            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                <button
                                    onClick={() => setShowEgresoModal(true)}
                                    className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all w-full sm:w-auto"
                                >
                                    + Egreso
                                </button>
                                <button onClick={handleCerrarCajaClick} className="btn-secondary w-full sm:w-auto">
                                    Cerrar Caja
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className="text-green-200 text-sm">Monto Inicial</p>
                                <p className="text-xl sm:text-2xl font-bold text-white">
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
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.totalEfectivo.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-purple-600 to-purple-800">
                                <p className="text-purple-200 text-sm mb-2">Transferencia</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.totalTransferencia.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-fuxia-primary to-fuxia-dark">
                                <p className="text-fuchsia-200 text-sm mb-2">Total</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.total.toLocaleString()}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={showCerrarConfirm}
                onClose={() => setShowCerrarConfirm(false)}
                title="¿Seguro que querés cerrar la caja?"
                maxWidth="max-w-sm"
            >
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                        Esto cerrará la caja del día. Podés volver a abrirla mañana.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={handleConfirmCerrar} className="btn-primary w-full sm:flex-1">
                            Confirmar
                        </button>
                        <button
                            onClick={() => setShowCerrarConfirm(false)}
                            className="btn-secondary w-full sm:flex-1"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                isOpen={showEgresoModal}
                onClose={() => setShowEgresoModal(false)}
                title="Registrar egreso"
                maxWidth="max-w-md"
            >
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Efectivo
                            </label>
                            <input
                                type="number"
                                value={egresoData.efectivo}
                                onChange={(e) => setEgresoData({ ...egresoData, efectivo: e.target.value })}
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
                                value={egresoData.transferencia}
                                onChange={(e) => setEgresoData({ ...egresoData, transferencia: e.target.value })}
                                className="input-field"
                                placeholder="0"
                                step="0.01"
                                min="0"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Observaciones de egreso
                        </label>
                        <textarea
                            value={egresoData.observaciones}
                            onChange={(e) => setEgresoData({ ...egresoData, observaciones: e.target.value })}
                            className="input-field"
                            rows="3"
                            placeholder="Ej: Compra de hielo..."
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={registrarEgreso} className="btn-primary w-full sm:flex-1">
                            Guardar
                        </button>
                        <button
                            onClick={() => setShowEgresoModal(false)}
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

export default Caja



