import { useState, useEffect, useRef } from 'react'
import api from '../utils/api'
import { toastError, toastInfo, toastSuccess } from '../utils/toast'
import Modal from '../components/Modal'
import { useModalHotkeys } from '../hooks/useModalHotkeys'

const Caja = () => {
    const [montoInicial, setMontoInicial] = useState('')
    const [fechaCaja, setFechaCaja] = useState('') // Fecha para abrir caja (opcional)
    const [montoInicialAnterior, setMontoInicialAnterior] = useState('')
    const [fechaCajaAnterior, setFechaCajaAnterior] = useState('')
    const [caja, setCaja] = useState(null) // Caja actualmente seleccionada/visible
    const [cajasAbiertas, setCajasAbiertas] = useState([]) // Todas las cajas abiertas
    const [cajasCerradas, setCajasCerradas] = useState([])
    const [turnos, setTurnos] = useState([])
    const [pedidos, setPedidos] = useState([])
    const dateInputRef = useRef(null)
    const [showCerrarConfirm, setShowCerrarConfirm] = useState(false)
    const [showEgresoModal, setShowEgresoModal] = useState(false)
    const [showAbrirCajaAnterior, setShowAbrirCajaAnterior] = useState(false)
    const [egresoData, setEgresoData] = useState({
        efectivo: '',
        transferencia: '',
        observaciones: '',
    })

    // Calcular resumen desde caja
    const calcularResumen = (cajaData) => {
        if (!cajaData) return null

        // Calcular egresos
        const egresosArray = Array.isArray(cajaData.egresos) ? cajaData.egresos : []
        const egresosTotal = egresosArray.reduce(
            (acc, e) => {
                acc.efectivo += Number(e?.efectivo || 0)
                acc.transferencia += Number(e?.transferencia || 0)
                return acc
            },
            { efectivo: 0, transferencia: 0 }
        )
        egresosTotal.total = (egresosTotal.efectivo || 0) + (egresosTotal.transferencia || 0)

        // Usar los totales que ya están guardados en la caja (calculados por el backend)
        // Esto evita problemas cuando la caja cruza medianoche
        const totalEfectivo = Number(cajaData.totalEfectivo || 0)
        const totalTransferencia = Number(cajaData.totalTransferencia || 0)

        // Calcular turnos: solo contar cantidad, NO sumar montos
        // Los montos de turnos ya están incluidos en totalEfectivo/totalTransferencia
        const fechaCaja = cajaData.fecha
        const cajaCreatedAt = cajaData.createdAt ? new Date(cajaData.createdAt) : null
        const cajaCerradaAt = cajaData.cerradaAt ? new Date(cajaData.cerradaAt) : null
        const ahora = new Date()

        // Determinar rango de tiempo de la caja
        const inicioCaja = cajaCreatedAt || new Date(fechaCaja + 'T00:00:00')
        const finCaja = cajaCerradaAt || ahora

        // Filtrar turnos directos que están dentro del rango de tiempo de la caja
        const turnosArray = Array.isArray(turnos) ? turnos : []
        const turnosEnRango = turnosArray.filter((t) => {
            if (!t || !t.createdAt) return false
            const fechaTurno = new Date(t.createdAt)
            return fechaTurno >= inicioCaja && fechaTurno <= finCaja && t.estado?.toLowerCase() === 'cobrado'
        })
        const cantidadTurnosDirectos = turnosEnRango.length

        // Contar turnos desde pedidos (producto "Turno Futbol")
        const TURNO_PRODUCTO_NOMBRE = 'turno futbol'
        const pedidosArray = Array.isArray(pedidos) ? pedidos : []
        const pedidosEnRango = pedidosArray.filter((p) => {
            if (!p || !p.createdAt) return false
            const fechaPedido = new Date(p.createdAt)
            return fechaPedido >= inicioCaja && fechaPedido <= finCaja && String(p.estado || '').toLowerCase() === 'cobrado'
        })

        const turnosDesdePedidos = pedidosEnRango.reduce(
            (acc, p) => {
                const items = Array.isArray(p.items) ? p.items : []
                for (const it of items) {
                    const nombre = String(it?.nombre || '').trim().toLowerCase()
                    if (nombre !== TURNO_PRODUCTO_NOMBRE) continue
                    const cantidad = Number(it?.cantidad || 0)
                    acc.cantidad += cantidad
                }
                return acc
            },
            { cantidad: 0 }
        )

        const cantidadTurnosFinal = cantidadTurnosDirectos + turnosDesdePedidos.cantidad

        return {
            totalEfectivo: totalEfectivo,
            totalTransferencia: totalTransferencia,
            totalMontoInicial: cajaData.montoInicial || 0,
            egresos: egresosTotal,
            turnos: { cantidad: cantidadTurnosFinal, total: 0 }, // No mostrar monto en tarjeta Turnos
            total: totalEfectivo + totalTransferencia + (cajaData.montoInicial || 0),
        }
    }

    const resumen = calcularResumen(caja)


    const fetchCaja = async () => {
        try {
            const [cajaRes, cajasAbiertasRes, turnosRes, pedidosRes] = await Promise.all([
                api.get('/caja/estado').catch(() => ({ data: null })),
                api.get('/caja/todas?cerradas=false').catch(() => ({ data: [] })),
                api.get('/turnos').catch(() => ({ data: [] })),
                api.get('/pedidos').catch(() => ({ data: [] })),
            ])
            const cajasAbiertasArray = Array.isArray(cajasAbiertasRes.data) ? cajasAbiertasRes.data : []
            setCajasAbiertas(cajasAbiertasArray)

            // Intentar restaurar la caja seleccionada desde localStorage
            const cajaSeleccionadaId = localStorage.getItem('cajaSeleccionadaId')

            // Determinar qué caja mostrar
            let cajaAMostrar = null

            // Si hay una caja seleccionada en el estado y sigue abierta, mantenerla
            if (caja && cajasAbiertasArray.find(c => c._id === caja._id)) {
                const cajaActualizada = cajasAbiertasArray.find(c => c._id === caja._id)
                if (cajaActualizada) {
                    cajaAMostrar = cajaActualizada
                    localStorage.setItem('cajaSeleccionadaId', cajaActualizada._id)
                    localStorage.setItem('cajaSeleccionadaFecha', cajaActualizada.fecha)
                }
            }

            // Si no hay caja en el estado, intentar restaurar desde localStorage
            if (!cajaAMostrar && cajaSeleccionadaId) {
                const cajaGuardada = cajasAbiertasArray.find(c => c._id === cajaSeleccionadaId)
                if (cajaGuardada) {
                    cajaAMostrar = cajaGuardada
                    localStorage.setItem('cajaSeleccionadaFecha', cajaGuardada.fecha)
                } else {
                    // La caja guardada ya no está abierta, limpiar localStorage
                    localStorage.removeItem('cajaSeleccionadaId')
                    localStorage.removeItem('cajaSeleccionadaFecha')
                }
            }

            // Si no hay caja seleccionada o guardada, usar la principal (más reciente)
            if (!cajaAMostrar) {
                cajaAMostrar = cajaRes.data || cajasAbiertasArray[0] || null
                if (cajaAMostrar) {
                    localStorage.setItem('cajaSeleccionadaId', cajaAMostrar._id)
                    localStorage.setItem('cajaSeleccionadaFecha', cajaAMostrar.fecha)
                } else {
                    // No hay cajas abiertas, limpiar localStorage
                    localStorage.removeItem('cajaSeleccionadaId')
                    localStorage.removeItem('cajaSeleccionadaFecha')
                }
            }

            setCaja(cajaAMostrar)
            setTurnos(turnosRes.data || [])
            setPedidos(pedidosRes.data || [])
        } catch (error) {
            console.error('Error fetching caja:', error)
        }
    }

    const fetchCajasCerradas = async () => {
        try {
            const res = await api.get('/caja/todas?cerradas=true')
            setCajasCerradas(res.data || [])
        } catch (error) {
            console.error('Error fetching cajas cerradas:', error)
        }
    }

    useEffect(() => {
        fetchCaja()
        fetchCajasCerradas()

        // Escuchar eventos de actualización de caja
        const handleCajaUpdate = () => {
            fetchCaja()
            fetchCajasCerradas()
        }
        window.addEventListener('caja-updated', handleCajaUpdate)

        // Escuchar cambios en localStorage (cuando otra pestaña/ventana cambia la caja)
        const handleStorageChange = (e) => {
            if (e.key === 'cajaSeleccionadaId' || e.key === 'cajaSeleccionadaFecha') {
                fetchCaja()
            }
        }
        window.addEventListener('storage', handleStorageChange)

        // Escuchar cambios de caja seleccionada desde otras páginas
        const handleCajaSeleccionadaCambiada = () => {
            fetchCaja()
        }
        window.addEventListener('caja-seleccionada-cambiada', handleCajaSeleccionadaCambiada)

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
            window.removeEventListener('storage', handleStorageChange)
            window.removeEventListener('caja-seleccionada-cambiada', handleCajaSeleccionadaCambiada)
            document.removeEventListener('visibilitychange', onVisibilityChange)
            stop()
        }
    }, [])

    const convertirFecha = (fechaStr) => {
        if (!fechaStr) return ''
        // Si está en formato DD/MM/YYYY, convertir a YYYY-MM-DD
        if (fechaStr.includes('/')) {
            const parts = fechaStr.split('/')
            if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`
            }
        }
        return fechaStr
    }

    const abrirCaja = async () => {
        // Validar que si se ingresa monto, sea válido (>= 0)
        if (montoInicial && parseFloat(montoInicial) < 0) {
            toastInfo('El monto inicial no puede ser negativo')
            return
        }
        try {
            const payload = {}
            // Solo enviar montoInicial si se proporcionó un valor
            if (montoInicial && montoInicial.trim() !== '') {
                payload.montoInicial = parseFloat(montoInicial) || 0
            }
            // Si se especificó una fecha, convertir a formato YYYY-MM-DD si es necesario
            if (fechaCaja) {
                const fechaParaEnviar = convertirFecha(fechaCaja)
                if (fechaParaEnviar) {
                    payload.fecha = fechaParaEnviar
                }
            }
            const res = await api.post('/caja/abrir', payload)
            // Guardar la caja abierta en localStorage INMEDIATAMENTE
            if (res.data) {
                localStorage.setItem('cajaSeleccionadaId', res.data._id)
                localStorage.setItem('cajaSeleccionadaFecha', res.data.fecha)
                // Disparar evento para que otras páginas se actualicen
                window.dispatchEvent(new Event('caja-seleccionada-cambiada'))
            }
            setMontoInicial('')
            setFechaCaja('') // Resetear fecha
            // Actualizar cajas abiertas y la caja actual
            await fetchCaja()
            toastSuccess('Caja abierta correctamente')
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al abrir la caja'
            toastError(`Error al abrir la caja: ${mensaje}`)
        }
    }

    const abrirCajaAnterior = async () => {
        if (!fechaCajaAnterior || fechaCajaAnterior.trim() === '') {
            toastInfo('Debes seleccionar una fecha')
            return
        }

        if (montoInicialAnterior && parseFloat(montoInicialAnterior) < 0) {
            toastInfo('El monto inicial no puede ser negativo')
            return
        }

        try {
            const fechaParaEnviar = convertirFecha(fechaCajaAnterior)
            if (!fechaParaEnviar) {
                toastInfo('La fecha ingresada no es válida')
                return
            }

            const payload = {
                permitirMultiples: true,
                fecha: fechaParaEnviar
            }

            if (montoInicialAnterior && montoInicialAnterior.trim() !== '') {
                payload.montoInicial = parseFloat(montoInicialAnterior) || 0
            }

            const res = await api.post('/caja/abrir', payload)

            if (res.data) {
                localStorage.setItem('cajaSeleccionadaId', res.data._id)
                localStorage.setItem('cajaSeleccionadaFecha', res.data.fecha)
                window.dispatchEvent(new Event('caja-seleccionada-cambiada'))

                setMontoInicialAnterior('')
                setFechaCajaAnterior('')
                setShowAbrirCajaAnterior(false)

                await fetchCaja()
                await fetchCajasCerradas()

                toastSuccess('Caja abierta correctamente')
            }
        } catch (error) {
            const mensaje = error.response?.data?.error || error.message || 'Error al abrir la caja'
            toastError(`Error al abrir la caja: ${mensaje}`)
        }
    }

    const cambiarCaja = (cajaId) => {
        const cajaSeleccionada = cajasAbiertas.find(c => c._id === cajaId)
        if (cajaSeleccionada) {
            setCaja(cajaSeleccionada)
            // Guardar la caja seleccionada en localStorage para persistirla
            localStorage.setItem('cajaSeleccionadaId', cajaSeleccionada._id)
            // Guardar también la fecha para que otras páginas puedan filtrar por fecha
            localStorage.setItem('cajaSeleccionadaFecha', cajaSeleccionada.fecha)
            // Disparar evento para que otras páginas se actualicen
            window.dispatchEvent(new Event('caja-seleccionada-cambiada'))
        }
    }

    const cerrarCaja = async () => {
        try {
            await api.post('/caja/cerrar', { id: caja._id })
            // Actualizar el estado de cajas abiertas inmediatamente
            const cajasAbiertasActualizadas = cajasAbiertas.filter(c => c._id !== caja._id)
            setCajasAbiertas(cajasAbiertasActualizadas)

            // Si se cerró la caja actual, cambiar a otra caja abierta si existe
            if (cajasAbiertasActualizadas.length > 0) {
                const nuevaCaja = cajasAbiertasActualizadas[0]
                setCaja(nuevaCaja) // Cambiar a la primera caja abierta disponible
                localStorage.setItem('cajaSeleccionadaId', nuevaCaja._id)
                localStorage.setItem('cajaSeleccionadaFecha', nuevaCaja.fecha)
            } else {
                setCaja(null) // No hay más cajas abiertas
                localStorage.removeItem('cajaSeleccionadaId')
                localStorage.removeItem('cajaSeleccionadaFecha')
            }
            fetchCaja()
            fetchCajasCerradas()
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
            // Enviar la fecha de la caja actual para que el egreso se registre en la caja correcta
            const payload = { efectivo, transferencia, observaciones }
            if (caja && caja.fecha) {
                payload.fecha = caja.fecha
            }
            await api.post('/caja/egreso', payload)
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
                    <form
                        className="space-y-4"
                        onSubmit={(e) => {
                            e.preventDefault()
                            abrirCaja()
                        }}
                    >
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Monto Inicial (Nuevo)
                            </label>
                            <input
                                type="number"
                                value={montoInicial}
                                onChange={(e) => setMontoInicial(e.target.value)}
                                placeholder="0.00"
                                className="input-field"
                                step="0.01"
                                min="0"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Fecha (opcional - por defecto hoy)
                            </label>
                            <div className="relative flex gap-2">
                                <input
                                    type="text"
                                    value={fechaCaja}
                                    onChange={(e) => {
                                        let value = e.target.value.replace(/\D/g, '') // Solo números

                                        // Limitar a 8 dígitos (DDMMYYYY)
                                        if (value.length > 8) value = value.slice(0, 8)

                                        // Formatear como DD/MM/YYYY
                                        let formatted = value
                                        if (value.length > 2) {
                                            formatted = value.slice(0, 2) + '/' + value.slice(2)
                                        }
                                        if (value.length > 4) {
                                            formatted = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8)
                                        }

                                        setFechaCaja(formatted)
                                    }}
                                    onKeyDown={(e) => {
                                        // Enter: enviar el formulario
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            abrirCaja()
                                            return
                                        }

                                        const nums = fechaCaja.replace(/\D/g, '')

                                        // Backspace: si está en posición de separador, borrar también el separador
                                        if (e.key === 'Backspace' && (fechaCaja.endsWith('/') || fechaCaja.length === 3 || fechaCaja.length === 6)) {
                                            e.preventDefault()
                                            const newNums = nums.slice(0, -1)
                                            let formatted = newNums
                                            if (newNums.length > 2) formatted = newNums.slice(0, 2) + '/' + newNums.slice(2)
                                            if (newNums.length > 4) formatted = newNums.slice(0, 2) + '/' + newNums.slice(2, 4) + '/' + newNums.slice(4)
                                            setFechaCaja(formatted)
                                        }

                                        // Al escribir números, avanzar automáticamente después de 2 y 4 dígitos
                                        if (e.key >= '0' && e.key <= '9' && nums.length < 8) {
                                            setTimeout(() => {
                                                const currentNums = fechaCaja.replace(/\D/g, '')
                                                if (currentNums.length === 2 && !fechaCaja.includes('/')) {
                                                    setFechaCaja(prev => prev + '/')
                                                } else if (currentNums.length === 4 && fechaCaja.split('/').length === 2) {
                                                    setFechaCaja(prev => prev + '/')
                                                }
                                            }, 0)
                                        }
                                    }}
                                    onBlur={() => {
                                        // Convertir DD/MM/YYYY a YYYY-MM-DD para el backend
                                        const parts = fechaCaja.split('/')
                                        if (parts.length === 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
                                            const day = parseInt(parts[0], 10)
                                            const month = parseInt(parts[1], 10)
                                            const year = parseInt(parts[2], 10)

                                            // Validar rangos
                                            if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900) {
                                                const date = new Date(year, month - 1, day)
                                                if (date.getDate() === day && date.getMonth() === month - 1) {
                                                    const maxDate = new Date()
                                                    maxDate.setHours(23, 59, 59, 999)
                                                    if (date <= maxDate) {
                                                        setFechaCaja(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
                                                        return
                                                    }
                                                }
                                            }
                                        }
                                        // Si no es válido o está incompleto, limpiar
                                        if (fechaCaja && fechaCaja.length < 10) {
                                            setFechaCaja('')
                                        }
                                    }}
                                    placeholder="DD/MM/YYYY"
                                    className="input-field flex-1"
                                    maxLength={10}
                                />
                                <input
                                    ref={dateInputRef}
                                    type="date"
                                    value={fechaCaja && !fechaCaja.includes('/') ? fechaCaja : ''}
                                    onChange={(e) => setFechaCaja(e.target.value)}
                                    className="absolute opacity-0 pointer-events-none w-0 h-0"
                                    max={new Date().toISOString().split('T')[0]}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (dateInputRef.current) {
                                            // Intentar usar showPicker (navegadores modernos)
                                            if (dateInputRef.current.showPicker) {
                                                dateInputRef.current.showPicker()
                                            } else {
                                                // Fallback: hacer click en el input
                                                dateInputRef.current.click()
                                            }
                                        }
                                    }}
                                    className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center justify-center"
                                    title="Abrir calendario"
                                >
                                    📅
                                </button>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Dejar vacío para usar la fecha de hoy. Puedes seleccionar una fecha anterior para abrir cajas retroactivas.
                            </p>
                        </div>
                        <button type="submit" className="btn-primary w-full">
                            Abrir Caja
                        </button>
                    </form>
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Selector de cajas abiertas si hay más de una */}
                    {cajasAbiertas.length > 1 && (
                        <div className="card bg-slate-800">
                            <label className="block text-sm font-medium text-slate-300 mb-2">
                                Seleccionar Caja:
                            </label>
                            <select
                                value={caja?._id || ''}
                                onChange={(e) => cambiarCaja(e.target.value)}
                                className="input-field w-full"
                            >
                                {cajasAbiertas.map((c) => (
                                    <option key={c._id} value={c._id}>
                                        {c.fecha || 'Sin fecha'} {c.cerrada ? '(Cerrada)' : '(Abierta)'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className={`card ${caja.cerrada ? 'bg-gradient-to-br from-slate-600 to-slate-800' : 'bg-gradient-to-br from-green-600 to-green-800'}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h3 className="text-lg sm:text-xl font-bold text-white">
                                {caja.cerrada ? 'Caja Cerrada' : 'Caja Abierta'}
                            </h3>
                            {!caja.cerrada && (
                                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                                    {(() => {
                                        if (!caja.fecha) return null

                                        // Obtener fecha de hoy en zona horaria local (Argentina)
                                        const ahora = new Date()
                                        const año = ahora.getFullYear()
                                        const mes = String(ahora.getMonth() + 1).padStart(2, '0')
                                        const dia = String(ahora.getDate()).padStart(2, '0')
                                        const hoy = `${año}-${mes}-${dia}`

                                        const fechaCaja = String(caja.fecha).split("T")[0].split(" ")[0]

                                        // Mostrar botón si la caja es de hoy
                                        if (fechaCaja === hoy) {
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAbrirCajaAnterior(true)}
                                                    className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all w-full sm:w-auto"
                                                >
                                                    Abrir Caja Anterior
                                                </button>
                                            )
                                        }
                                        return null
                                    })()}
                                    <button
                                        type="button"
                                        onClick={() => setShowEgresoModal(true)}
                                        className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all w-full sm:w-auto"
                                    >
                                        + Egreso
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCerrarCajaClick}
                                        className="btn-secondary w-full sm:w-auto"
                                    >
                                        Cerrar Caja
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <p className={`text-sm ${caja.cerrada ? 'text-slate-200' : 'text-green-200'}`}>Monto Inicial</p>
                                <p className="text-xl sm:text-2xl font-bold text-white">
                                    ${caja.montoInicial.toLocaleString()}
                                </p>
                            </div>
                            <div>
                                <p className={`text-sm ${caja.cerrada ? 'text-slate-200' : 'text-green-200'}`}>Fecha</p>
                                <p className="text-lg font-semibold text-white">{caja.fecha || 'Sin fecha'}</p>
                            </div>
                        </div>
                    </div>

                    {resumen && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div className="card bg-gradient-to-br from-blue-600 to-blue-800">
                                <p className="text-blue-200 text-sm mb-2">Efectivo</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.totalEfectivo.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-purple-600 to-purple-800">
                                <p className="text-purple-200 text-sm mb-2">Transferencias</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.totalTransferencia.toLocaleString()}
                                </p>
                            </div>
                            <div className="card bg-gradient-to-br from-red-600 to-red-800">
                                <p className="text-red-200 text-sm mb-2">Egresos Hoy</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    ${resumen.egresos.total.toLocaleString()}
                                </p>
                                {(resumen.egresos.total > 0) && (
                                    <p className="text-xs text-red-100 mt-1">
                                        Ef: ${resumen.egresos.efectivo.toLocaleString()} / Tr: ${resumen.egresos.transferencia.toLocaleString()}
                                    </p>
                                )}
                            </div>
                            <div className="card bg-gradient-to-br from-orange-600 to-orange-800">
                                <p className="text-orange-200 text-sm mb-2">Turnos</p>
                                <p className="text-2xl sm:text-3xl font-bold text-white">
                                    x{resumen.turnos.cantidad}
                                </p>
                            </div>
                        </div>
                    )}

                    {resumen && (
                        <div className="card bg-gradient-to-br from-fuxia-primary to-fuxia-dark">
                            <p className="text-fuchsia-200 text-sm mb-2">Total</p>
                            <p className="text-2xl sm:text-3xl font-bold text-white">
                                ${resumen.total.toLocaleString()}
                            </p>
                        </div>
                    )}
                </div>
            )}

            <Modal
                isOpen={showCerrarConfirm}
                onClose={() => setShowCerrarConfirm(false)}
                title="¿Seguro que quieres cerrar la caja?"
                maxWidth="max-w-sm"
            >
                <div className="space-y-4">
                    <p className="text-slate-300 text-sm">
                        Esto cerrará la caja del día de la fecha.
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

            <Modal
                isOpen={showAbrirCajaAnterior}
                onClose={() => {
                    setShowAbrirCajaAnterior(false)
                    setMontoInicialAnterior('')
                    setFechaCajaAnterior('')
                }}
                title="Abrir Caja de Fecha Anterior"
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        abrirCajaAnterior()
                    }}
                    className="space-y-4"
                >
                    <p className="text-slate-300 text-sm">
                        Puedes abrir una caja de cualquier fecha pasada. Los movimientos se registrarán en la caja correspondiente a cada fecha.
                    </p>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Fecha (requerido)
                        </label>
                        <div className="relative flex gap-2">
                            <input
                                type="text"
                                value={fechaCajaAnterior}
                                onChange={(e) => {
                                    let value = e.target.value.replace(/\D/g, '')
                                    if (value.length > 8) value = value.slice(0, 8)
                                    let formatted = value
                                    if (value.length > 2) {
                                        formatted = value.slice(0, 2) + '/' + value.slice(2)
                                    }
                                    if (value.length > 4) {
                                        formatted = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4, 8)
                                    }
                                    setFechaCajaAnterior(formatted)
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        abrirCajaAnterior()
                                    }
                                }}
                                placeholder="DD/MM/YYYY"
                                className="input-field flex-1"
                                maxLength={10}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => {
                                    const dateInput = document.createElement('input')
                                    dateInput.type = 'date'
                                    dateInput.max = new Date().toISOString().split('T')[0]
                                    dateInput.onchange = (e) => {
                                        if (e.target.value) {
                                            setFechaCajaAnterior(e.target.value)
                                        }
                                    }
                                    dateInput.click()
                                }}
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                                title="Abrir calendario"
                            >
                                📅
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Monto Inicial (opcional)
                        </label>
                        <input
                            type="number"
                            value={montoInicialAnterior}
                            onChange={(e) => setMontoInicialAnterior(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault()
                                    abrirCajaAnterior()
                                }
                            }}
                            placeholder="0.00"
                            className="input-field"
                            step="0.01"
                            min="0"
                        />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                        <button type="submit" className="btn-primary w-full sm:flex-1">
                            Abrir Caja
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setShowAbrirCajaAnterior(false)
                                setMontoInicialAnterior('')
                                setFechaCajaAnterior('')
                            }}
                            className="btn-secondary w-full sm:flex-1"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    )
}

export default Caja



