import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
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
                    <Route path="/" element={<Panel />} />
                    <Route path="/panel" element={<Panel />} />
                    <Route path="/caja" element={<Caja />} />
                    <Route path="/mesas" element={<Mesas />} />
                    <Route path="/pedidos" element={<Pedidos />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/turnos" element={<Turnos />} />
                    <Route path="/historico" element={<Historico />} />
                    <Route path="/metricas" element={<Metricas />} />
                </Routes>
            </Layout>
        </Router>
    )
}

export default App


