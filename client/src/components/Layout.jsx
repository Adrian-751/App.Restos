import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useRef } from 'react'
import { useAuth } from '../context/AuthContext'

const Layout = ({ children }) => {
    const location = useLocation()
    const navigate = useNavigate()
    const { token, user, logout } = useAuth()
    const navScrollRef = useRef(null)

    const isAuthPage = location.pathname === '/login' || location.pathname === '/register'
    const showWatermark = !location.pathname.startsWith('/mesas')

    const navItems = [
        { path: '/', label: 'Gestión', icon: '📊' },
        { path: '/caja', label: 'Caja', icon: '💰' },
        { path: '/mesas', label: 'Mesas', icon: '🪑' },
        { path: '/pedidos', label: 'Pedidos', icon: '📝' },
        { path: '/clientes', label: 'Clientes', icon: '👥' },
        { path: '/productos', label: 'Productos', icon: '🍽️' },
        { path: '/turnos', label: 'Turnos', icon: '🎫' },
        { path: '/historico', label: 'Histórico', icon: '📚' },
        ...(user?.role === 'admin' ? [{ path: '/metricas', label: 'Métricas', icon: '📈' }] : []),
    ]

    return (
        <div className="min-h-screen bg-dark-bg relative overflow-x-hidden">
            {/* Watermark global (NO en Mesas para no afectar el mapa) */}
            {showWatermark && (
                <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center">
                    <img
                        src="/GastroGestion-Mod2-Blanco.png"
                        alt=""
                        aria-hidden="true"
                        className="opacity-[0.15] w-[min(78vw,720px)] max-w-none select-none"
                    />
                </div>
            )}

            {/* Header */}
            <header className="relative z-10">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 aspect-square shrink-0 bg-fuxia-primary rounded-full flex items-center justify-center shadow-lg overflow-hidden">
                                <img
                                    src="/Algarrobo-512x512.png"
                                    alt="Algarrobos Futbol"
                                    className="w-14 h-14"
                                    loading="eager"
                                />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-fuxia-primary">ALGARROBOS FUTBOL</h1>
                                <p className="text-white text-lg">Gastro Gestión</p>
                            </div>
                        </div>

                        {!isAuthPage && token && (
                            <div className="flex items-center gap-3">
                                <div className="hidden sm:block text-right">
                                    <p className="text-white text-sm font-semibold">{user?.nombre || 'Usuario'}</p>
                                    <p className="text-fuxia-primary text-xs">{user?.role || ''}</p>
                                </div>
                                <button
                                    className="bg-white/15 hover:bg-white/25 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-all"
                                    onClick={() => {
                                        logout()
                                        navigate('/login', { replace: true })
                                    }}
                                >
                                    Cerrar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="relative z-10 container mx-auto px-4 py-8">
                {children}
            </main>

            {/* Bottom Navigation */}
            {!isAuthPage && (
                <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 shadow-2xl pb-[env(safe-area-inset-bottom)] touch-manipulation">
                    <div className="container mx-auto px-4">
                        <div className="relative">
                            {/* Botón izquierda (móvil) */}
                            <button
                                type="button"
                                aria-label="Scroll izquierda"
                                className="sm:hidden absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700 text-white flex items-center justify-center touch-manipulation"
                                onClick={() => navScrollRef.current?.scrollBy({ left: -220, behavior: 'smooth' })}
                            >
                                ‹
                            </button>

                            {/* Botón derecha (móvil) */}
                            <button
                                type="button"
                                aria-label="Scroll derecha"
                                className="sm:hidden absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-slate-800/90 border border-slate-700 text-white flex items-center justify-center touch-manipulation"
                                onClick={() => navScrollRef.current?.scrollBy({ left: 220, behavior: 'smooth' })}
                            >
                                ›
                            </button>

                            <div
                                ref={navScrollRef}
                                className="flex items-center gap-2 py-3 overflow-x-auto sm:overflow-x-visible sm:justify-around scroll-smooth px-10 sm:px-0 touch-pan-x"
                                style={{ WebkitOverflowScrolling: 'touch' }}
                            >
                                {navItems.map((item) => {
                                    const isActive = item.path === '/'
                                        ? (location.pathname === '/' || location.pathname === '/panel')
                                        : location.pathname === item.path

                                    return (
                                        <Link
                                            key={item.path}
                                            to={item.path}
                                            className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-lg transition-all duration-200 shrink-0 ${isActive
                                                ? 'bg-fuxia-primary text-white'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                }`}
                                        >
                                            <span className="text-2xl">{item.icon}</span>
                                            <span className="text-xs font-medium whitespace-nowrap">{item.label}</span>
                                        </Link>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                </nav>
            )}

            {/* Spacer for bottom nav */}
            {!isAuthPage && <div className="h-24 sm:h-20 pointer-events-none"></div>}
        </div>
    )
}

export default Layout


