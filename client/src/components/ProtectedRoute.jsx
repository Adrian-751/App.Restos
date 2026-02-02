import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ProtectedRoute = ({ children, roles }) => {
    const location = useLocation()
    const { token, user, loading } = useAuth()

    if (loading) {
        return (
            <div className="card text-center py-10">
                <p className="text-slate-400">Cargando sesión...</p>
            </div>
        )
    }

    if (!token) {
        return <Navigate to="/login" replace state={{ from: location }} />
    }

    if (Array.isArray(roles) && roles.length > 0) {
        const userRole = user?.role
        if (!userRole || !roles.includes(userRole)) {
            return <Navigate to="/panel" replace />
        }
    }

    return children
}

export default ProtectedRoute

