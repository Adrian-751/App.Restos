import express from 'express';
import { getLotes, createLote, deleteLote } from '../controllers/loteController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getLotes);
router.post('/', createLote);
router.delete('/:id', deleteLote);

export default router;
