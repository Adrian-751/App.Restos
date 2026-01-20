import { Link, useLocation } from 'react-router-dom'

const Layout = ({ children }) => {
    const location = useLocation()

    const navItems = [
        { path: '/', label: 'Gestión', icon: '📊' },
        { path: '/caja', label: 'Caja', icon: '💰' },
        { path: '/mesas', label: 'Mesas', icon: '🪑' },
        { path: '/pedidos', label: 'Pedidos', icon: '📝' },
        { path: '/clientes', label: 'Clientes', icon: '👥' },
        { path: '/productos', label: 'Productos', icon: '🍽️' },
        { path: '/turnos', label: 'Turnos', icon: '🎫' },
        { path: '/historico', label: 'Histórico', icon: '📚' },
        { path: '/metricas', label: 'Métricas', icon: '📈' },
    ]

    return (
        <div className="min-h-screen bg-dark-bg">
            {/* Header */}
            <header className="bg-gradient-to-r from-fuxia-primary to-fuxia-dark shadow-2xl">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl font-bold text-fuxia-primary shadow-lg">
                                A
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">ALGARROBOS FUTBOL</h1>
                                <p className="text-fuxia-light text-sm">Sistema de Gestión</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>

            {/* Bottom Navigation */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 shadow-2xl">
                <div className="container mx-auto px-4">
                    <div className="flex justify-around items-center py-3">
                        {navItems.map((item) => {
                            const isActive = item.path === '/'
                                ? (location.pathname === '/' || location.pathname === '/panel')
                                : location.pathname === item.path

                            return (
                                <Link
                                    key={item.path}
                                    to={item.path}
                                    className={`flex flex-col items-center space-y-1 px-4 py-2 rounded-lg transition-all duration-200 ${isActive
                                        ? 'bg-fuxia-primary text-white'
                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                >
                                    <span className="text-2xl">{item.icon}</span>
                                    <span className="text-xs font-medium">{item.label}</span>
                                </Link>
                            )
                        })}
                    </div>
                </div>
            </nav>

            {/* Spacer for bottom nav */}
            <div className="h-20"></div>
        </div>
    )
}

export default Layout


