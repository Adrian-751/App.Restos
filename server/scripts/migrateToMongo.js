/**
 * Script de Migración: JSON a MongoDB
 * 
 * Este script migra todos los datos de los archivos JSON a MongoDB
 * 
 * USO:
 * 1. Asegúrate de tener MongoDB corriendo
 * 2. Ejecuta: node server/scripts/migrateToMongo.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Cargar variables de entorno
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Importar modelos
import Caja from '../models/Caja.js';
import Mesa from '../models/Mesa.js';
import Producto from '../models/Producto.js';
import Cliente from '../models/Cliente.js';
import Pedido from '../models/Pedido.js';

// Función para leer archivos JSON
const readJSONFile = (filename) => {
    const filePath = path.join(__dirname, '../data', filename);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Archivo ${filename} no existe, se creará vacío`);
        return [];
    }
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`❌ Error leyendo ${filename}:`, error.message);
        return [];
    }
};

// Función para migrar datos
const migrate = async () => {
    try {
        // Conectar a MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado a MongoDB');

        // Limpiar colecciones existentes (opcional - comentar si quieres mantener datos)
        console.log('🗑️  Limpiando colecciones existentes...');
        await Caja.deleteMany({});
        await Mesa.deleteMany({});
        await Producto.deleteMany({});
        await Cliente.deleteMany({});
        await Pedido.deleteMany({});

        // Migrar Mesas
        console.log('📦 Migrando Mesas...');
        const mesasData = readJSONFile('mesas.json');
        if (mesasData.length > 0) {
            // Convertir datos al formato del modelo
            const mesas = mesasData
                .map(mesa => {
                    // Convertir numero a Number
                    const numero = typeof mesa.numero === 'string' 
                        ? parseInt(mesa.numero, 10) 
                        : (typeof mesa.numero === 'number' ? mesa.numero : null);
                    
                    // Filtrar registros inválidos
                    if (!numero || isNaN(numero)) {
                        console.warn(`⚠️  Mesa inválida omitida:`, mesa);
                        return null;
                    }
                    
                    return {
                        numero: numero,
                        nombre: mesa.nombre || `Mesa ${numero}`,
                        x: mesa.x || 0,
                        y: mesa.y || 0,
                        color: mesa.color || '#e11d48',
                        estado: mesa.estado || 'libre',
                        createdAt: mesa.createdAt ? new Date(mesa.createdAt) : new Date(),
                        updatedAt: new Date()
                    };
                })
                .filter(mesa => mesa !== null); // Filtrar valores null
            
            if (mesas.length > 0) {
                // Filtrar duplicados por numero
                const mesasUnicas = [];
                const numerosVistos = new Set();
                mesas.forEach(mesa => {
                    if (!numerosVistos.has(mesa.numero)) {
                        numerosVistos.add(mesa.numero);
                        mesasUnicas.push(mesa);
                    } else {
                        console.warn(`⚠️  Mesa duplicada omitida (numero: ${mesa.numero}):`, mesa.nombre);
                    }
                });
                
                await Mesa.insertMany(mesasUnicas, { ordered: false });
                console.log(`✅ ${mesasUnicas.length} mesas migradas`);
            } else {
                console.log('⚠️  No hay mesas válidas para migrar');
            }
        }

        // Migrar Productos
        console.log('📦 Migrando Productos...');
        const productosData = readJSONFile('productos.json');
        if (productosData.length > 0) {
            const productos = productosData.map(prod => ({
                numero: prod.numero || prod.id,
                nombre: prod.nombre,
                precio: prod.precio || 0,
                stock: prod.stock || 0,
                cantidadDisponible: prod.cantidadDisponible || prod.stock || 0,
                categoria: prod.categoria || 'general',
                createdAt: prod.createdAt ? new Date(prod.createdAt) : new Date(),
                updatedAt: new Date()
            }));
            await Producto.insertMany(productos);
            console.log(`✅ ${productos.length} productos migrados`);
        }

        // Migrar Clientes
        console.log('📦 Migrando Clientes...');
        const clientesData = readJSONFile('clientes.json');
        if (clientesData.length > 0) {
            const clientes = clientesData.map(cliente => ({
                numero: cliente.numero || cliente.id,
                nombre: cliente.nombre,
                cuentaCorriente: cliente.cuentaCorriente || 0,
                pagos: cliente.pagos || [],
                createdAt: cliente.createdAt ? new Date(cliente.createdAt) : new Date(),
                updatedAt: new Date()
            }));
            await Cliente.insertMany(clientes);
            console.log(`✅ ${clientes.length} clientes migrados`);
        }

        // Migrar Cajas
        console.log('📦 Migrando Cajas...');
        const cajasData = readJSONFile('cajas.json');
        if (cajasData.length > 0) {
            const cajas = cajasData.map(caja => ({
                fecha: caja.fecha,
                montoInicial: caja.montoInicial || 0,
                totalEfectivo: caja.totalEfectivo || 0,
                totalTransferencia: caja.totalTransferencia || 0,
                totalDia: caja.totalDia || 0,
                ventas: caja.ventas || [],
                cerrada: caja.cerrada || false,
                cerradaAt: caja.cerradaAt ? new Date(caja.cerradaAt) : null,
                createdAt: caja.createdAt ? new Date(caja.createdAt) : new Date(),
                updatedAt: new Date()
            }));
            await Caja.insertMany(cajas);
            console.log(`✅ ${cajas.length} cajas migradas`);
        }

        // Migrar Pedidos (más complejo porque tiene referencias)
        console.log('📦 Migrando Pedidos...');
        const pedidosData = readJSONFile('pedidos.json');
        if (pedidosData.length > 0) {
            // Primero obtener todos los IDs de mesas y clientes
            const mesas = await Mesa.find();
            const clientes = await Cliente.find();
            const productos = await Producto.find();

            // Crear mapas para buscar por ID antiguo
            const mesaMap = new Map();
            mesas.forEach(mesa => {
                // Si el número coincide con algún ID antiguo
                mesaMap.set(mesa.numero, mesa._id);
            });

            const clienteMap = new Map();
            clientes.forEach(cliente => {
                clienteMap.set(cliente.numero, cliente._id);
            });

            const productoMap = new Map();
            productos.forEach(prod => {
                productoMap.set(prod.numero, prod._id);
            });

            const pedidos = [];
            for (const pedidoData of pedidosData) {
                // Buscar mesaId si existe
                let mesaId = null;
                if (pedidoData.mesaId) {
                    // Intentar encontrar por número o ID
                    const mesa = mesas.find(m => 
                        m.numero === pedidoData.mesaId || 
                        m._id.toString() === pedidoData.mesaId
                    );
                    mesaId = mesa ? mesa._id : null;
                }

                // Buscar clienteId si existe
                let clienteId = null;
                if (pedidoData.clienteId) {
                    const cliente = clientes.find(c => 
                        c.numero === pedidoData.clienteId || 
                        c._id.toString() === pedidoData.clienteId
                    );
                    clienteId = cliente ? cliente._id : null;
                }

                // Mapear items con productoId
                const items = (pedidoData.items || []).map(item => {
                    let productoId = null;
                    if (item.productoId) {
                        const producto = productos.find(p => 
                            p.numero === item.productoId || 
                            p._id.toString() === item.productoId
                        );
                        productoId = producto ? producto._id : null;
                    }

                    return {
                        productoId,
                        nombre: item.nombre,
                        cantidad: item.cantidad || 1,
                        precio: item.precio || 0,
                        precioOriginal: item.precioOriginal || item.precio || 0
                    };
                });

                pedidos.push({
                    mesaId,
                    clienteId,
                    items,
                    total: pedidoData.total || 0,
                    efectivo: pedidoData.efectivo || 0,
                    transferencia: pedidoData.transferencia || 0,
                    observaciones: pedidoData.observaciones || '',
                    estado: pedidoData.estado || 'Pendiente',
                    createdAt: pedidoData.createdAt ? new Date(pedidoData.createdAt) : new Date(),
                    updatedAt: new Date()
                });
            }

            await Pedido.insertMany(pedidos);
            console.log(`✅ ${pedidos.length} pedidos migrados`);
        }

        console.log('\n🎉 ¡Migración completada exitosamente!');
        console.log('\n📊 Resumen:');
        console.log(`   - Mesas: ${await Mesa.countDocuments()}`);
        console.log(`   - Productos: ${await Producto.countDocuments()}`);
        console.log(`   - Clientes: ${await Cliente.countDocuments()}`);
        console.log(`   - Cajas: ${await Caja.countDocuments()}`);
        console.log(`   - Pedidos: ${await Pedido.countDocuments()}`);

    } catch (error) {
        console.error('❌ Error en la migración:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\n👋 Conexión cerrada');
    }
};

// Ejecutar migración
migrate();

