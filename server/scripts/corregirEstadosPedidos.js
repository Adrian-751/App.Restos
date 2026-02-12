import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/app-restos';

async function corregirEstados() {
    try {
        console.log('🔌 Conectando a MongoDB...');
        await mongoose.connect(mongoURI);
        console.log('✅ Conectado a MongoDB\n');

        const Pedido = mongoose.model('Pedido', new mongoose.Schema({}, { strict: false }));

        // Corregir estados de pedidos que NO están cobrados ni cancelados
        console.log('🔧 Corrigiendo estados de pedidos...');
        const resultado = await Pedido.updateMany(
            {
                estado: { $nin: ['Cobrado', 'cobrado', 'Cancelado', 'cancelado'] }
            },
            {
                $set: { estado: 'Pendiente' }
            }
        );

        console.log(`\n✅ ${resultado.modifiedCount} pedidos actualizados a estado "Pendiente"`);

        // Verificar
        const pedidosPendientes = await Pedido.find({
            estado: 'Pendiente'
        }).countDocuments();

        console.log(`\n📊 Total de pedidos con estado "Pendiente": ${pedidosPendientes}`);

        await mongoose.disconnect();
        console.log('\n✅ Desconectado de MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

corregirEstados();
