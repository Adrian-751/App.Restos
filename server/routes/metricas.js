import express from 'express';
import { getMetricasSemana, getMetricasMes } from '../controllers/metricasController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

router.get('/semana', authorize('admin'), getMetricasSemana);
router.get('/mes', authorize('admin'), getMetricasMes);

export default router;