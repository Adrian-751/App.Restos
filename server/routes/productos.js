import express from 'express';
import { getProductos, createProducto, updateProducto, deleteProducto } from '../controllers/productoController.js';
import { authenticate } from '../middleware/auth.js';
import { validateProducto, validateProductoUpdate } from '../middleware/validate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getProductos);
router.post('/', validateProducto, createProducto);
router.put('/:id', validateProductoUpdate, updateProducto);
router.delete('/:id', deleteProducto);

export default router;