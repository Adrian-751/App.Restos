import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import api from '../utils/api'
import { clearAuth, getToken, getUser, saveToken, saveUser } from '../utils/auth'

const AuthContext = createContext(null)

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(() => getToken())
    const [user, setUser] = useState(() => getUser())
    const [loading, setLoading] = useState(() => !!getToken())
    const didInitRef = useRef(false)

    const setSession = (nextToken, nextUser) => {
        if (nextToken) saveToken(nextToken)
        if (nextUser) saveUser(nextUser)
        setToken(nextToken || null)
        setUser(nextUser || null)
    }

    const logout = () => {
        clearAuth()
        setToken(null)
        setUser(null)
    }

    const refreshMe = async () => {
        const currentToken = getToken()
        if (!currentToken) {
            setLoading(false)
            setToken(null)
            setUser(null)
            return
        }

        setLoading(true)
        try {
            const res = await api.get('/auth/me')
            const me = res.data?.user || null
            saveUser(me)
            setToken(currentToken)
            setUser(me)
        } catch (err) {
            // Importante para PWA/móvil:
            // - Si falla por red/servidor momentáneo, NO cerramos sesión.
            // - Solo cerramos sesión si el backend responde "no autorizado" (token inválido/expirado).
            const status = err?.response?.status
            if (status === 401 || status === 403) {
                logout()
                return
            }
            // Mantener lo que haya en storage/memoria para no pedir login al reabrir
            setToken(currentToken)
            setUser((prev) => prev || getUser())
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        // En React StrictMode el efecto puede ejecutarse 2 veces en dev
        if (didInitRef.current) return
        didInitRef.current = true
        refreshMe()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const value = useMemo(
        () => ({
            token,
            user,
            loading,
            isAuthenticated: !!token,
            setSession,
            refreshMe,
            logout,
        }),
        [token, user, loading]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
    return ctx
}

