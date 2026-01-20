import express from 'express';
import { getMesas, createMesa, updateMesa, deleteMesa } from '../controllers/mesaController.js';
import { authenticate } from '../middleware/auth.js';
import { validateMesa, validateMesaUpdate } from '../middleware/validate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getMesas);
router.post('/', validateMesa, createMesa);
router.put('/:id', validateMesaUpdate, updateMesa);
router.delete('/:id', deleteMesa);

export default router;