import { getCajaModel } from '../models/Caja.js'
import { getClienteModel } from '../models/Cliente.js'
import { getMesaModel } from '../models/Mesa.js'
import { getPedidoModel } from '../models/Pedido.js'
import { getProductoModel } from '../models/Producto.js'
import { getTurnoModel } from '../models/Turno.js'
import { getUserModel } from '../models/User.js'

export const getModels = (conn) => {
    return {
        Caja: getCajaModel(conn),
        Cliente: getClienteModel(conn),
        Mesa: getMesaModel(conn),
        Pedido: getPedidoModel(conn),
        Producto: getProductoModel(conn),
        Turno: getTurnoModel(conn),
        User: getUserModel(conn),
    }
}

