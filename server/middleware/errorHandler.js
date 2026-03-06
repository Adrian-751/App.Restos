
/* Middleware centralizado para manejar errores
 * Captura todos los errores y los formatea de manera consistente
 */
export const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Error de validación (de express-validator)
    if (err.name === 'ValidationError' || err.name === 'CastError') {
        return res.status(400).json({
            error: 'Error de validación',
            message: err.message,
            details: err.errors || err.message
        });
    }

    // Error de MongoDB (duplicado, etc)
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({
            error: 'Dato duplicado',
            message: `El ${field} ya existe en la base de datos`
        });
    }

    // Error de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Token inválido',
            message: 'El token proporcionado no es válido'
        });
    }

    // Error genérico
    res.status(err.status || 500).json({
        error: err.message || 'Error interno del servidor',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};


/* Wrapper para manejar errores en funciones async
 * Evita tener que usar try-catch en cada controlador
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};