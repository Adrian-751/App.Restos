import { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import PageLoader from './components/PageLoader'

// Route-level code splitting (carga cada sección al entrar)
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Panel = lazy(() => import('./pages/Panel'))
const Caja = lazy(() => import('./pages/Caja'))
const Mesas = lazy(() => import('./pages/Mesas'))
const Pedidos = lazy(() => import('./pages/Pedidos'))
const Clientes = lazy(() => import('./pages/Clientes'))
const Productos = lazy(() => import('./pages/Productos'))
const Turnos = lazy(() => import('./pages/Turnos'))
const Historico = lazy(() => import('./pages/Historico'))
const Metricas = lazy(() => import('./pages/Metricas'))

function App() {
    return (
        <Router>
            <Layout>
                <Suspense fallback={<PageLoader />}>
                    <Routes>
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />

                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <Panel />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/panel"
                            element={
                                <ProtectedRoute>
                                    <Panel />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/caja"
                            element={
                                <ProtectedRoute>
                                    <Caja />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/mesas"
                            element={
                                <ProtectedRoute>
                                    <Mesas />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/pedidos"
                            element={
                                <ProtectedRoute>
                                    <Pedidos />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/clientes"
                            element={
                                <ProtectedRoute>
                                    <Clientes />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/productos"
                            element={
                                <ProtectedRoute>
                                    <Productos />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/turnos"
                            element={
                                <ProtectedRoute>
                                    <Turnos />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/historico"
                            element={
                                <ProtectedRoute>
                                    <Historico />
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/metricas"
                            element={
                                <ProtectedRoute roles={['admin']}>
                                    <Metricas />
                                </ProtectedRoute>
                            }
                        />
                    </Routes>
                </Suspense>
            </Layout>
        </Router>
    )
}

export default App


