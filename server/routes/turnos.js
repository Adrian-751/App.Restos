import express from 'express';
import { getTurnos, createTurno, updateTurno, deleteTurno } from '../controllers/turnoController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/', getTurnos);
router.post('/', createTurno);
router.put('/:id', updateTurno);
router.delete('/:id', deleteTurno);

export default router;