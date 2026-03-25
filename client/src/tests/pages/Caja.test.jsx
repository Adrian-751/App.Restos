/**
 * Tests para Caja.jsx
 *
 * Cubren dos áreas:
 *   1. calcularResumen — función pura exportada (lógica financiera)
 *   2. Componente <Caja> — resiliencia ante errores de red (bug de producción)
 *
 * Bug de producción reproducido:
 *   Cuando el backend sufría un error transitorio, fetchCaja recibía listas
 *   vacías por el .catch() silencioso, borraba el localStorage y ponía
 *   caja=null. El usuario veía la pantalla de "Abrir Caja" y al intentar
 *   abrirla recibía "Ya existe una caja abierta". El fix preserva el estado
 *   existente cuando ambos endpoints de caja fallan simultáneamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { calcularResumen } from '../../pages/Caja.jsx'

// ─── Mock de dependencias externas ───────────────────────────────────────────

vi.mock('../../utils/api', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
}))

vi.mock('../../utils/toast', () => ({
    toastError: vi.fn(),
    toastInfo: vi.fn(),
    toastSuccess: vi.fn(),
}))

// useModalHotkeys no necesita lógica real en estos tests
vi.mock('../../hooks/useModalHotkeys', () => ({
    useModalHotkeys: vi.fn(),
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCaja = (overrides = {}) => ({
    _id: 'caja-test-id',
    fecha: '2026-03-06',
    cerrada: false,
    montoInicial: 500,
    totalEfectivo: 1000,
    totalTransferencia: 300,
    egresos: [],
    createdAt: new Date('2026-03-06T08:00:00Z').toISOString(),
    ...overrides,
})

const makePedidoCobrado = (items = [], cobradoAt = '2026-03-06T18:00:00Z') => ({
    estado: 'cobrado',
    cobradoAt: new Date(cobradoAt).toISOString(),
    items,
})

/** Configura el mock de api.get para una caja abierta dada. */
const mockApiSuccess = async (caja) => {
    const { default: api } = await import('../../utils/api')
    api.get.mockImplementation((url) => {
        if (url === '/caja/estado') return Promise.resolve({ data: caja })
        if (url.includes('/caja/todas')) return Promise.resolve({ data: caja ? [caja] : [] })
        if (url === '/turnos') return Promise.resolve({ data: [] })
        if (url === '/pedidos') return Promise.resolve({ data: [] })
        return Promise.reject(new Error(`Unexpected URL: ${url}`))
    })
}

/** Configura el mock de api.get para simular un error de red total. */
const mockApiNetworkError = async () => {
    const { default: api } = await import('../../utils/api')
    api.get.mockRejectedValue(new Error('Network Error'))
}

// ─── 1. calcularResumen — función pura ───────────────────────────────────────

describe('calcularResumen', () => {
    it('returns null when cajaData is null', () => {
        expect(calcularResumen(null, [], [])).toBeNull()
    })

    it('returns null when cajaData is undefined', () => {
        expect(calcularResumen(undefined, [], [])).toBeNull()
    })

    it('computes efectivoNeto = montoInicial + totalEfectivo - egresos.efectivo', () => {
        const caja = makeCaja({
            montoInicial: 500,
            totalEfectivo: 1000,
            totalTransferencia: 300,
            egresos: [{ efectivo: 200, transferencia: 50 }],
        })
        const result = calcularResumen(caja, [], [])
        // efectivoNeto = 500 + 1000 - 200 = 1300
        expect(result.totalEfectivo).toBe(1300)
        expect(result.totalTransferencia).toBe(300)
    })

    it('computes total = efectivoNeto + totalTransferencia - egresos.transferencia', () => {
        const caja = makeCaja({
            montoInicial: 500,
            totalEfectivo: 1000,
            totalTransferencia: 300,
            egresos: [{ efectivo: 200, transferencia: 0 }],
        })
        const result = calcularResumen(caja, [], [])
        // efectivoNeto = 500+1000-200 = 1300; total = 1300+300-0 = 1600
        expect(result.total).toBe(1600)
    })

    it('sums multiple egresos correctly', () => {
        const caja = makeCaja({
            montoInicial: 0,
            totalEfectivo: 500,
            totalTransferencia: 0,
            egresos: [
                { efectivo: 100, transferencia: 20 },
                { efectivo: 50, transferencia: 30 },
            ],
        })
        const result = calcularResumen(caja, [], [])
        expect(result.egresos.efectivo).toBe(150)
        expect(result.egresos.transferencia).toBe(50)
        expect(result.egresos.total).toBe(200)
    })

    it('handles missing egresos array without throwing', () => {
        const caja = makeCaja({ egresos: undefined, montoInicial: 100, totalEfectivo: 400 })
        const result = calcularResumen(caja, [], [])
        expect(result.egresos.total).toBe(0)
        expect(result.totalEfectivo).toBe(500) // 100 + 400 - 0
    })

    it('returns zeros for a newly opened empty caja', () => {
        const caja = makeCaja({ montoInicial: 0, totalEfectivo: 0, totalTransferencia: 0, egresos: [] })
        const result = calcularResumen(caja, [], [])
        expect(result.totalEfectivo).toBe(0)
        expect(result.totalTransferencia).toBe(0)
        expect(result.total).toBe(0)
        expect(result.egresos.total).toBe(0)
        expect(result.turnosFutbol.cantidad).toBe(0)
        expect(result.turnosPadel.cantidad).toBe(0)
        expect(result.eventos.cantidad).toBe(0)
        expect(result.kiosco.total).toBe(0)
    })

    it('counts only cobrado turnos within the caja time range', () => {
        const cajaCreatedAt = new Date('2026-03-06T10:00:00Z')
        const caja = makeCaja({ createdAt: cajaCreatedAt.toISOString() })
        const turnos = [
            { estado: 'cobrado', cobradoAt: new Date('2026-03-06T12:00:00Z').toISOString() },
            { estado: 'cobrado', cobradoAt: new Date('2026-03-06T09:00:00Z').toISOString() },
            { estado: 'pendiente', cobradoAt: new Date('2026-03-06T11:00:00Z').toISOString() },
            { estado: 'cobrado' },
        ]
        const result = calcularResumen(caja, turnos, [])
        expect(result.turnosFutbol.cantidad).toBe(1)
    })

    it('counts "Turno Futbol" items from cobrado pedidos (case-insensitive)', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Turno Futbol', cantidad: 2, precio: 5000 },
                { nombre: 'TURNO FUTBOL', cantidad: 1, precio: 5000 },
                { nombre: 'Milanesa', cantidad: 3, precio: 2000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosFutbol.cantidad).toBe(3)
        expect(result.turnosFutbol.total).toBe(15000)
    })

    it('combines direct turnos and turno-futbol pedido items', () => {
        const caja = makeCaja()
        const turnos = [
            { estado: 'cobrado', cobradoAt: new Date('2026-03-06T10:00:00Z').toISOString() },
        ]
        const pedidos = [
            makePedidoCobrado([{ nombre: 'Turno Futbol', cantidad: 2, precio: 5000 }]),
        ]
        const result = calcularResumen(caja, turnos, pedidos)
        expect(result.turnosFutbol.cantidad).toBe(3)
    })

    it('uses cerradaAt as finCaja when caja is closed (no counts after close)', () => {
        const cerradaAt = new Date('2026-03-06T14:00:00Z')
        const caja = makeCaja({
            cerrada: true,
            cerradaAt: cerradaAt.toISOString(),
        })
        const turnos = [
            { estado: 'cobrado', cobradoAt: new Date('2026-03-06T13:00:00Z').toISOString() },
            { estado: 'cobrado', cobradoAt: new Date('2026-03-06T15:00:00Z').toISOString() },
        ]
        const result = calcularResumen(caja, turnos, [])
        expect(result.turnosFutbol.cantidad).toBe(1)
    })

    // ─── Turnos Pádel ────────────────────────────────────────────────────────

    it('counts "Turno Pádel" items in turnosPadel card (with accent)', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Turno Pádel', cantidad: 3, precio: 6000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosPadel.cantidad).toBe(3)
        expect(result.turnosPadel.total).toBe(18000)
    })

    it('"Turno Pádel" is case-insensitive', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'TURNO PÁDEL', cantidad: 1, precio: 6000 },
                { nombre: 'turno pádel', cantidad: 2, precio: 6000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosPadel.cantidad).toBe(3)
    })

    // ─── Eventos ─────────────────────────────────────────────────────────────

    it('counts "Evento" items in eventos card', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Evento', cantidad: 2, precio: 10000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.eventos.cantidad).toBe(2)
        expect(result.eventos.total).toBe(20000)
    })

    it('"Evento" is case-insensitive', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'EVENTO', cantidad: 1, precio: 10000 },
                { nombre: 'evento', cantidad: 1, precio: 10000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.eventos.cantidad).toBe(2)
    })

    // ─── Kiosco ──────────────────────────────────────────────────────────────

    it('sums non-special items in kiosco', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Pizza', cantidad: 2, precio: 3000 },
                { nombre: 'Cerveza', cantidad: 4, precio: 1500 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.kiosco.total).toBe(12000)
    })

    it('kiosco includes non-special items even when pedido also has special items', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Turno Futbol', cantidad: 1, precio: 5000 },
                { nombre: 'Pizza', cantidad: 2, precio: 3000 },
                { nombre: 'Fernet', cantidad: 1, precio: 4000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosFutbol.cantidad).toBe(1)
        expect(result.turnosFutbol.total).toBe(5000)
        expect(result.kiosco.total).toBe(10000) // 2*3000 + 1*4000
    })

    it('kiosco is zero when pedido only has special items', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Turno Futbol', cantidad: 1, precio: 5000 },
                { nombre: 'Turno Pádel', cantidad: 1, precio: 6000 },
                { nombre: 'Evento', cantidad: 1, precio: 10000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.kiosco.total).toBe(0)
    })

    // ─── Pedido mixto completo ───────────────────────────────────────────────

    it('distributes a mixed pedido correctly across all cards', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Turno Futbol', cantidad: 1, precio: 5000 },
                { nombre: 'Turno Pádel', cantidad: 2, precio: 6000 },
                { nombre: 'Evento', cantidad: 1, precio: 10000 },
                { nombre: 'Pizza', cantidad: 3, precio: 2000 },
                { nombre: 'Cerveza', cantidad: 5, precio: 1500 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosFutbol.cantidad).toBe(1)
        expect(result.turnosFutbol.total).toBe(5000)
        expect(result.turnosPadel.cantidad).toBe(2)
        expect(result.turnosPadel.total).toBe(12000)
        expect(result.eventos.cantidad).toBe(1)
        expect(result.eventos.total).toBe(10000)
        expect(result.kiosco.total).toBe(13500) // 3*2000 + 5*1500
    })

    it('sums across multiple pedidos', () => {
        const caja = makeCaja()
        const pedidos = [
            makePedidoCobrado([
                { nombre: 'Pizza', cantidad: 1, precio: 3000 },
                { nombre: 'Turno Futbol', cantidad: 1, precio: 5000 },
            ]),
            makePedidoCobrado([
                { nombre: 'Cerveza', cantidad: 2, precio: 1500 },
                { nombre: 'Turno Pádel', cantidad: 1, precio: 6000 },
            ]),
            makePedidoCobrado([
                { nombre: 'Evento', cantidad: 1, precio: 10000 },
            ]),
        ]
        const result = calcularResumen(caja, [], pedidos)
        expect(result.turnosFutbol.cantidad).toBe(1)
        expect(result.turnosPadel.cantidad).toBe(1)
        expect(result.eventos.cantidad).toBe(1)
        expect(result.kiosco.total).toBe(6000) // 3000 + 2*1500
    })
})

// ─── 2. Componente <Caja> — resiliencia ante errores de red ──────────────────

describe('Caja component - network resilience (production bug regression)', () => {
    beforeEach(() => {
        vi.resetAllMocks()
        localStorage.clear()
    })

    it('shows "Abrir Caja" form when API returns no open cajas (legitimate empty)', async () => {
        await mockApiSuccess(null)
        const { default: Caja } = await import('../../pages/Caja.jsx')
        render(<Caja />)
        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Abrir Caja/i })).toBeInTheDocument()
        })
    })

    it('shows caja dashboard when API returns an open caja', async () => {
        const caja = makeCaja()
        await mockApiSuccess(caja)
        const { default: Caja } = await import('../../pages/Caja.jsx')
        render(<Caja />)
        await waitFor(() => {
            expect(screen.getByText('Caja Abierta')).toBeInTheDocument()
        })
    })

    it('REGRESSION: preserves caja state when both caja API endpoints fail (network error)', async () => {
        const { default: api } = await import('../../utils/api')
        const caja = makeCaja()

        // Primera carga: éxito — muestra la caja
        await mockApiSuccess(caja)
        const { default: Caja } = await import('../../pages/Caja.jsx')
        render(<Caja />)
        await waitFor(() => {
            expect(screen.getByText('Caja Abierta')).toBeInTheDocument()
        })

        // Segundo fetch: ambos endpoints de caja fallan (error de red transitorio)
        await mockApiNetworkError()

        await act(async () => {
            window.dispatchEvent(new Event('caja-updated'))
            // Le damos tiempo al async handler
            await new Promise((r) => setTimeout(r, 80))
        })

        // La caja debe seguir visible — no debe mostrar "Abrir Caja"
        expect(screen.getByText('Caja Abierta')).toBeInTheDocument()
    })

    it('REGRESSION: does NOT clear localStorage when caja endpoints return network error', async () => {
        const { default: api } = await import('../../utils/api')
        const caja = makeCaja()

        await mockApiSuccess(caja)
        const { default: Caja } = await import('../../pages/Caja.jsx')
        render(<Caja />)
        await waitFor(() => {
            expect(screen.getByText('Caja Abierta')).toBeInTheDocument()
        })

        const savedId = localStorage.getItem('cajaSeleccionadaId')
        expect(savedId).toBeTruthy()

        // Simular error de red
        await mockApiNetworkError()
        await act(async () => {
            window.dispatchEvent(new Event('caja-updated'))
            await new Promise((r) => setTimeout(r, 80))
        })

        // El localStorage no debe haber sido borrado
        expect(localStorage.getItem('cajaSeleccionadaId')).toBe(savedId)
    })
})
