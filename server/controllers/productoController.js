import { asyncHandler } from '../middleware/errorHandler.js';

/**
 * Obtener todos los productos
 * GET /api/productos
 */
export const getProductos = asyncHandler(async (req, res) => {
    const { Producto } = req.models
    const productos = await Producto.find().sort({ numero: 1 });
    res.json(productos);
});


/* Crear nuevo producto
 * POST /api/productos
 */
export const createProducto = asyncHandler(async (req, res) => {
    const { Producto } = req.models
    const { nombre, precio, stock, categoria, descripcion } = req.body;

    // Calcular número automático si no se proporciona
    let numero = req.body.numero;
    if (!numero) {
        const ultimoProducto = await Producto.findOne().sort({ numero: -1 });
        numero = ultimoProducto ? ultimoProducto.numero + 1 : 1;
    }

    const producto = await Producto.create({
        numero,
        nombre,
        precio: parseFloat(precio) || 0,
        stock: parseInt(stock) || 0,
        cantidadDisponible: parseInt(stock) || 0,
        categoria: categoria || 'general',
        descripcion: descripcion || ''
    });

    res.status(201).json(producto);
});


/* Actualizar producto
 * PUT /api/productos/:id
 */
export const updateProducto = asyncHandler(async (req, res) => {
    const { Producto } = req.models
    const producto = await Producto.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
    );

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
});


/* Eliminar producto
 * DELETE /api/productos/:id
 */
export const deleteProducto = asyncHandler(async (req, res) => {
    const { Producto } = req.models
    const producto = await Producto.findByIdAndDelete(req.params.id);

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ success: true });
});