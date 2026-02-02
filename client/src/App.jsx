import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Panel from './pages/Panel'
import Caja from './pages/Caja'
import Mesas from './pages/Mesas'
import Pedidos from './pages/Pedidos'
import Clientes from './pages/Clientes'
import Productos from './pages/Productos'
import Turnos from './pages/Turnos'
import Historico from './pages/Historico'
import Metricas from './pages/Metricas'

function App() {
    return (
        <Router>
            <Layout>
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
            </Layout>
        </Router>
    )
}

export default App


