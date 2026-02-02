import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../utils/api'
import { useAuth } from '../context/AuthContext'

const Register = () => {
    const navigate = useNavigate()
    const { token, setSession } = useAuth()

    const [nombre, setNombre] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [role, setRole] = useState('admin')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        if (token) navigate('/panel', { replace: true })
    }, [token, navigate])

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const res = await api.post('/auth/register', { nombre, email, password, role })
            setSession(res.data?.token, res.data?.user)
            navigate('/panel', { replace: true })
        } catch (err) {
            setError(err?.response?.data?.error || 'No se pudo crear el usuario')
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
                        <h2 className="text-2xl font-bold text-white">Crear usuario</h2>
                        <p className="text-slate-400 text-sm">Primer acceso / nueva cuenta</p>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-200 text-sm">
                        {error}
                    </div>
                )}

                <form onSubmit={onSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Nombre</label>
                        <input
                            className="input-field"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Nombre y apellido"
                            required
                            autoComplete="name"
                        />
                    </div>

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
                            placeholder="mínimo 6 caracteres"
                            required
                            minLength={6}
                            autoComplete="new-password"
                        />
                    </div>

                    <div>
                        <label className="block text-sm text-slate-300 mb-1">Rol</label>
                        <select
                            className="input-field"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                        >
                            <option value="admin">Admin</option>
                            <option value="cajero">Cajero</option>
                            <option value="mesero">Mesero</option>
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            Tip: para el primer usuario, usá <b>Admin</b>.
                        </p>
                    </div>

                    <button className="btn-primary w-full disabled:opacity-60" disabled={loading}>
                        {loading ? 'Creando...' : 'Crear y entrar'}
                    </button>
                </form>

                <div className="mt-5 text-sm text-slate-400">
                    ¿Ya tenés cuenta?{' '}
                    <Link className="text-fuxia-light hover:text-white" to="/login">
                        Iniciar sesión
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default Register

