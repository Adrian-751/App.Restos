import express from 'express';
import { getMetricasSemana, getMetricasMes } from '../controllers/metricasController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/semana', getMetricasSemana);
router.get('/mes', getMetricasMes);

export default router;