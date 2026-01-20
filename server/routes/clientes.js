import express from 'express';
import { getClientes, createCliente, updateCliente, deleteCliente, registrarPago } from '../controllers/clienteController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getClientes);
router.post('/', createCliente);
router.put('/:id', updateCliente);
router.delete('/:id', deleteCliente);
router.post('/:id/pago', registrarPago);

export default router;