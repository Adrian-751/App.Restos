import axios from 'axios';

/**
 * Instancia de axios configurada con:
 * - Base URL de la API
 * - Interceptor para agregar token JWT automáticamente
 * - Interceptor para manejar errores de autenticación
 */

const isIPv4 = (host) => /^(\d{1,3}\.){3}\d{1,3}$/.test(host)

const getTenantFromHost = () => {
    const host = (window.location.hostname || '').toLowerCase()
    if (!host) return 'default'

    // Dev/local: permitir elegir tenant
    if (host === 'localhost' || host === '127.0.0.1' || isIPv4(host)) {
        // 1) query param ?tenant=xxx (útil en dev)
        const url = new URL(window.location.href)
        const qp = url.searchParams.get('tenant')
        if (qp) return String(qp).trim().toLowerCase()

        // 2) localStorage (útil para “persistir” el tenant en dev)
        const ls = localStorage.getItem('tenant')
        if (ls) return String(ls).trim().toLowerCase()

        return 'default'
    }

    // Producción: tenant = primer subdominio (cliente1.tudominio.com -> cliente1)
    const parts = host.split('.').filter(Boolean)
    if (parts.length >= 3) return parts[0]

    return 'default'
}

const api = axios.create({
    // En dev, Vite proxya /api -> http://localhost:3000 (ver vite.config.js)
    baseURL: import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || '/api'),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor de request: agregar token a cada petición
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Multi-tenant: enviar tenant para que el backend elija la DB del cliente
        // (en prod normalmente viene por subdominio, pero esto ayuda en dev y en APIs con dominio separado).
        if (!config.headers['X-Tenant'] && !config.headers['x-tenant']) {
            config.headers['X-Tenant'] = getTenantFromHost()
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor de response: manejar errores
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Si el error es 401 (no autenticado), eliminar token y redirigir
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Opcional: redirigir a login
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;

