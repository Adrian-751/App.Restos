import express from 'express';
import { getProductos, createProducto, updateProducto, deleteProducto } from '../controllers/productoController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getProductos);
router.post('/', createProducto);
router.put('/:id', updateProducto);
router.delete('/:id', deleteProducto);

export default router;