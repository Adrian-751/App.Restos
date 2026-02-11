// SCRIPT URGENTE PARA FIX DE PEDIDOS
// Ejecutar en MongoDB Atlas (MongoSH) o Compass

// 1. Ver todos los pedidos pendientes de hoy
db.pedidos.find({
    estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] },
    createdAt: {
        $gte: new Date(new Date().setHours(0, 0, 0, 0)),
        $lt: new Date(new Date().setHours(23, 59, 59, 999))
    }
}).pretty()

// 2. Verificar si hay pedidos con estado incorrecto
db.pedidos.find({
    estado: { $nin: ['Pendiente', 'pendiente', 'Cuenta Corriente', 'cuenta corriente', 'Cobrado', 'cobrado', 'Cancelado', 'cancelado'] }
}).pretty()

// 3. CORREGIR: Asegurar que pedidos de hoy con estado pendiente sean visibles
// (Solo ejecutar si es necesario)
db.pedidos.updateMany(
    {
        createdAt: {
            $gte: new Date(new Date().setHours(0, 0, 0, 0)),
            $lt: new Date(new Date().setHours(23, 59, 59, 999))
        },
        estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] }
    },
    {
        $set: { estado: 'Pendiente' }
    }
)

// 4. Ver todos los pedidos NO cobrados (para verificar)
db.pedidos.find({
    estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] }
}).sort({ createdAt: -1 }).limit(20).pretty()
