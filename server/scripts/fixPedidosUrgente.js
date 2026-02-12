import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// IMPORTANTE: Este script usa la variable de entorno MONGODB_URI
// Para producción, asegúrate de que esté configurada en tu servidor
const mongoURI = process.env.MONGODB_URI;

if (!mongoURI) {
    console.error('❌ Error: MONGODB_URI no está configurada en las variables de entorno');
    console.error('   Configura MONGODB_URI en tu servidor de producción');
    process.exit(1);
}

async function fixPedidos() {
    try {
        console.log('🔌 Conectando a MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ Conectado a MongoDB\n');

        const Pedido = mongoose.model('Pedido', new mongoose.Schema({}, { strict: false }));

        // PASO 1: Ver todos los pedidos pendientes
        console.log('📋 PASO 1: Buscando pedidos pendientes...');
        const pedidosPendientes = await Pedido.find({
            estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] }
        }).sort({ createdAt: -1 }).limit(20);

        console.log(`\n✅ Encontrados ${pedidosPendientes.length} pedidos pendientes:\n`);
        pedidosPendientes.forEach((p, i) => {
            console.log(`${i + 1}. ID: ${p._id}`);
            console.log(`   Estado: ${p.estado}`);
            console.log(`   Fecha: ${p.createdAt}`);
            console.log(`   Total: $${p.total || 0}`);
            console.log('');
        });

        // PASO 2: Ver pedidos de hoy
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const mañana = new Date(hoy);
        mañana.setDate(mañana.getDate() + 1);

        console.log('📅 PASO 2: Buscando pedidos de HOY...');
        const pedidosHoy = await Pedido.find({
            estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] },
            createdAt: {
                $gte: hoy,
                $lt: mañana
            }
        }).sort({ createdAt: -1 });

        console.log(`\n✅ Encontrados ${pedidosHoy.length} pedidos pendientes de HOY:\n`);
        pedidosHoy.forEach((p, i) => {
            console.log(`${i + 1}. ID: ${p._id}`);
            console.log(`   Estado: ${p.estado}`);
            console.log(`   Fecha: ${p.createdAt}`);
            console.log(`   Total: $${p.total || 0}`);
            console.log('');
        });

        // PASO 3: Preguntar si quiere corregir estados
        console.log('\n⚠️  Si los pedidos tienen estados incorrectos, ejecuta el siguiente comando:');
        console.log('   node server/scripts/corregirEstadosPedidos.js\n');

        await mongoose.disconnect();
        console.log('✅ Desconectado de MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixPedidos();
