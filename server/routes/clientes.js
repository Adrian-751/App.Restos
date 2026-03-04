import express from 'express';
import { getClientes, createCliente, updateCliente, deleteCliente, registrarPago } from '../controllers/clienteController.js';
import { authenticate } from '../middleware/auth.js';
import { validateCliente, validateClienteUpdate } from '../middleware/validate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getClientes);
router.post('/', validateCliente, createCliente);
router.put('/:id', validateClienteUpdate, updateCliente);
router.delete('/:id', deleteCliente);
router.post('/:id/pago', registrarPago);

export default router;