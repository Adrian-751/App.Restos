import { validationResult, body } from 'express-validator';


/* Middleware para verificar los resultados de validación
* Debe usarse después de los validadores de express-validator
*/
export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Error de validación',
            errors: errors.array()
        });
    }

    next();
};

// Validaciones para mesas (solo para crear)
export const validateMesa = [
    body('numero')
        .notEmpty()
        .withMessage('El número de mesa es requerido'),
    body('nombre')
        .optional()
        .trim(),
    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('El color debe ser un código hexadecimal válido'),
    validate
];

// Validaciones para actualizar mesa (permite actualizaciones parciales)
export const validateMesaUpdate = [
    body('numero')
        .optional()
        .notEmpty()
        .withMessage('El número de mesa no puede estar vacío'),
    body('nombre')
        .optional()
        .trim(),
    body('color')
        .optional()
        .matches(/^#[0-9A-F]{6}$/i)
        .withMessage('El color debe ser un código hexadecimal válido'),
    body('x')
        .optional()
        .isNumeric()
        .withMessage('La coordenada x debe ser un número'),
    body('y')
        .optional()
        .isNumeric()
        .withMessage('La coordenada y debe ser un número'),
    validate
];

// Validaciones para productos
export const validateProducto = [
    body('nombre')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    body('precio')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo'),
    body('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('El stock debe ser un número entero positivo'),
    validate
];

// Validaciones para clientes
export const validateCliente = [
    body('nombre')
        .trim()
        .notEmpty()
        .withMessage('El nombre es requerido')
        .isLength({ min: 2, max: 100 })
        .withMessage('El nombre debe tener entre 2 y 100 caracteres'),
    validate
];

// Validaciones para pedidos
export const validatePedido = [
    body('items')
        .isArray({ min: 1 })
        .withMessage('Debe tener al menos un item'),
    body('items.*.productoId')
        .notEmpty()
        .withMessage('Cada item debe tener un productoId'),
    body('items.*.cantidad')
        .isInt({ min: 1 })
        .withMessage('La cantidad debe ser un número entero positivo'),
    body('items.*.precio')
        .isFloat({ min: 0 })
        .withMessage('El precio debe ser un número positivo'),
    validate
];