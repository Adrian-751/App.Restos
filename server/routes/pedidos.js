import express from 'express';
import { getPedidos, createPedido, updatePedido, deletePedido } from '../controllers/pedidoController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getPedidos);
router.post('/', createPedido);
router.put('/:id', updatePedido);
router.delete('/:id', deletePedido);

export default router;