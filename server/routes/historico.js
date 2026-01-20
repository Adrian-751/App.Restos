import express from 'express';
import { getHistorico, deleteItemHistorico } from '../controllers/historicoController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getHistorico);
router.delete('/:id', deleteItemHistorico);

export default router;