import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const Login = () => {
    const navigate = useNavigate()
    const location = useLocation()
    const { token, setSession } = useAuth()

    const from = useMemo(() => location.state?.from?.pathname || '/panel', [location.state])

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    // Si ya hay token, no tiene sentido mostrar login
    useEffect(() => {
        if (token) navigate(from, { replace: true })
    }, [token, from, navigate])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await api.post('/auth/login', { email, password })
            setSession(res.data?.token, res.data?.user)
            navigate(from, { replace: true })
        } catch (err) {
            setError(err?.response?.data?.error || 'No se pudo iniciar sesión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-[calc(100vh-5rem)] flex items-center justify-center px-4">
            <div className="card w-full max-w-md">
                <div className="flex items-center gap-3 mb-6">
                    <img src="/pwa-192x192-2.png" alt="Algarrobos Futbol" className="w-10 h-10 rounded-full" />
                    <div>
                        <h2 className="text-2xl font-bold text-white">Iniciar sesión</h2>
                        <p className="text-slate-400 text-sm">Accedé al sistema</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Email</label>
                        <input
                            className="input-field"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Contraseña</label>
                        <input
                            className="input-field"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            minLength={6}
                            autoComplete="current-password"
                        />
                    </div>

                    <button className="btn-primary w-full disabled:opacity-60" disabled={loading}>
                        {loading ? 'Ingresando...' : 'Ingresar'}
                    </button>
                </form>

                <div className="mt-5 text-sm text-slate-400">
                    ¿No tenés cuenta?{' '}
                    <Link className="text-fuxia-light hover:text-white" to="/register">
                        Crear usuario
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default Login

