import axios from 'axios';

/**
 * Instancia de axios configurada con:
 * - Base URL de la API
 * - Interceptor para agregar token JWT automáticamente
 * - Interceptor para manejar errores de autenticación
 */

const api = axios.create({
    // En dev, Vite proxya /api -> http://localhost:3000 (ver vite.config.js)
    baseURL: import.meta.env.VITE_API_URL || '/api',
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
            // Opcional: redirigir a login
            // window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;

