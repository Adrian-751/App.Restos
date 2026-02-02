import { asyncHandler } from '../middleware/errorHandler.js';


/* Obtener todos los clientes
 * GET /api/clientes
 */
export const getClientes = asyncHandler(async (req, res) => {
    const { Cliente } = req.models
    const clientes = await Cliente.find().sort({ nombre: 1 });
    res.json(clientes);
});


/* Crear nuevo cliente
 * POST /api/clientes
 */
export const createCliente = asyncHandler(async (req, res) => {
    const { Cliente } = req.models
    const { nombre, numero, contacto } = req.body;

    // Si no se proporciona número, calcular el siguiente
    let numeroCliente = numero;
    if (!numeroCliente) {
        const ultimoCliente = await Cliente.findOne().sort({ numero: -1 });
        numeroCliente = ultimoCliente ? ultimoCliente.numero + 1 : 1;
    }

    const cliente = await Cliente.create({
        numero: numeroCliente,
        nombre,
        cuentaCorriente: 0,
        pagos: [],
        contacto: contacto || {}
    });

    res.status(201).json(cliente);
});


/* Actualizar cliente
 * PUT /api/clientes/:id
 */
export const updateCliente = asyncHandler(async (req, res) => {
    const { Cliente } = req.models
    const cliente = await Cliente.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
});

/**
 * Eliminar cliente
 * DELETE /api/clientes/:id
 */
export const deleteCliente = asyncHandler(async (req, res) => {
    const { Cliente } = req.models
    const cliente = await Cliente.findByIdAndDelete(req.params.id);

    if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({ success: true });
});


/* Registrar pago de cliente
 * POST /api/clientes/:id/pago
 */
export const registrarPago = asyncHandler(async (req, res) => {
    const { Cliente } = req.models
    const { monto, efectivo, transferencia, observaciones } = req.body;
    const cliente = await Cliente.findById(req.params.id);

    if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    const pago = {
        monto: parseFloat(monto),
        efectivo: parseFloat(efectivo) || 0,
        transferencia: parseFloat(transferencia) || 0,
        observaciones: observaciones || '',
        fecha: new Date()
    };

    cliente.pagos = cliente.pagos || [];
    cliente.pagos.push(pago);
    cliente.cuentaCorriente = (cliente.cuentaCorriente || 0) - pago.monto;

    await cliente.save();

    res.json(cliente);
});