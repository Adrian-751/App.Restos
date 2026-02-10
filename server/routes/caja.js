import express from 'express';
import { getEstado, abrirCaja, cerrarCaja, getResumen, registrarEgreso, getTodasCajas } from '../controllers/cajaController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

router.get('/estado', getEstado);
router.post('/abrir', abrirCaja);
router.post('/cerrar', cerrarCaja);
router.post('/egreso', registrarEgreso);
router.get('/resumen/:fecha?', getResumen);
router.get('/todas', getTodasCajas);

export default router;