import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'

// Ping de calentamiento: dispara lo antes posible para despertar el backend
// (Render free tier duerme tras 15min de inactividad — esto inicia el wake-up
//  antes de que React cargue, así el servidor ya está listo cuando el usuario
//  interactúa con la app)
if (import.meta.env.PROD) {
    const warmupUrl = (import.meta.env.VITE_API_URL || 'https://app-restos-api-d45z.onrender.com/api') + '/health'
    fetch(warmupUrl, { signal: AbortSignal.timeout(55000) }).catch(() => {})
}

// Registro del Service Worker (PWA) sin plugin (estable para deploy)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {
            // Si falla el SW, la app igual funciona (solo sin offline/cache)
        })
    })
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>,
)


