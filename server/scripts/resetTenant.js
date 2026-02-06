/**
 * Reset de datos por tenant (multi-tenant)
 *
 * Objetivo típico para "entrega":
 * - Borrar datos operativos: Caja, Pedido, Turno
 * - Resetear estado de mesas a "libre"
 * - Mantener: usuarios, productos y el mapa/posiciones de mesas (configurable)
 *
 * Uso:
 *   node scripts/resetTenant.js --tenant algarrobos --confirm
 *
 * Opciones:
 *   --tenant <name>        Tenant a resetear (obligatorio)
 *   --mode soft|hard       soft (default): borra Caja/Pedido/Turno y pone mesas en libre
 *                          hard: además borra Cliente (y opcionalmente Productos/Mesas)
 *   --keep-users           (default) NO borra usuarios
 *   --drop-users           borra usuarios del tenant
 *   --keep-products        (default) NO borra productos
 *   --drop-products        borra productos del tenant
 *   --keep-mesas           (default) NO borra mesas (solo resetea estado)
 *   --drop-mesas           borra mesas del tenant
 *   --dry-run              no ejecuta nada, solo muestra el plan
 *   --confirm              requerido para ejecutar (anti-accidentes)
 */

import dotenv from 'dotenv'
dotenv.config()

import { getTenantConnection, getTenantMongoUri } from '../tenancy/connectionManager.js'
import { getModels } from '../tenancy/models.js'

const parseArgs = (argv) => {
    const args = {}
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (!a.startsWith('--')) continue
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('--')) {
            args[key] = next
            i++
        } else {
            args[key] = true
        }
    }
    return args
}

const maskMongoUri = (uri) => {
    if (!uri) return uri
    // mongodb://user:pass@host -> mongodb://<redacted>@host
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@]+)@/i, '$1<redacted>@')
}

const main = async () => {
    const args = parseArgs(process.argv.slice(2))

    const tenant = String(args.tenant || '').trim().toLowerCase()
    if (!tenant) {
        console.error('❌ Falta --tenant <name>')
        process.exitCode = 1
        return
    }

    const mode = String(args.mode || 'soft').toLowerCase()
    const dryRun = !!args['dry-run']
    const confirmed = !!args.confirm

    const dropUsers = !!args['drop-users']
    const dropProducts = !!args['drop-products']
    const dropMesas = !!args['drop-mesas']

    const keepUsers = args['keep-users'] ? true : !dropUsers
    const keepProducts = args['keep-products'] ? true : !dropProducts
    const keepMesas = args['keep-mesas'] ? true : !dropMesas

    const alsoDropClientes = mode === 'hard'

    const uri = getTenantMongoUri(tenant)

    console.log(`\nTenant: ${tenant}`)
    console.log(`Mongo URI: ${maskMongoUri(uri)}`)
    console.log(`Mode: ${mode}`)
    console.log(`Keep: users=${keepUsers} products=${keepProducts} mesas=${keepMesas}`)
    console.log(`Plan:`)
    console.log(`- borrar: Caja, Pedido, Turno`)
    if (alsoDropClientes) console.log(`- borrar: Cliente (mode=hard)`)
    if (keepMesas) console.log(`- mesas: updateMany -> estado="libre"`)
    else console.log(`- borrar: Mesa`)
    if (!keepProducts) console.log(`- borrar: Producto`)
    if (!keepUsers) console.log(`- borrar: User`)

    if (dryRun) {
        console.log('\n🧪 Dry-run: no se ejecutó nada.\n')
        return
    }

    if (!confirmed) {
        console.log('\n⚠️  Por seguridad, este script NO se ejecuta sin --confirm.\n')
        console.log(`Ejemplo:\n  node scripts/resetTenant.js --tenant ${tenant} --confirm\n`)
        process.exitCode = 2
        return
    }

    const conn = await getTenantConnection(tenant)
    const { Caja, Pedido, Turno, Mesa, Cliente, Producto, User } = getModels(conn)

    try {
        console.log('\n🧹 Reseteando datos...')

        const [cajaRes, pedidoRes, turnoRes] = await Promise.all([
            Caja.deleteMany({}),
            Pedido.deleteMany({}),
            Turno.deleteMany({}),
        ])

        console.log(`✅ Caja eliminadas: ${cajaRes.deletedCount ?? 0}`)
        console.log(`✅ Pedidos eliminados: ${pedidoRes.deletedCount ?? 0}`)
        console.log(`✅ Turnos eliminados: ${turnoRes.deletedCount ?? 0}`)

        if (alsoDropClientes) {
            const clienteRes = await Cliente.deleteMany({})
            console.log(`✅ Clientes eliminados: ${clienteRes.deletedCount ?? 0}`)
        }

        if (keepMesas) {
            const mesaRes = await Mesa.updateMany({}, { $set: { estado: 'libre' } })
            console.log(`✅ Mesas reseteadas a libre: ${mesaRes.modifiedCount ?? 0}`)
        } else {
            const mesaRes = await Mesa.deleteMany({})
            console.log(`✅ Mesas eliminadas: ${mesaRes.deletedCount ?? 0}`)
        }

        if (!keepProducts) {
            const prodRes = await Producto.deleteMany({})
            console.log(`✅ Productos eliminados: ${prodRes.deletedCount ?? 0}`)
        }

        if (!keepUsers) {
            const userRes = await User.deleteMany({})
            console.log(`✅ Usuarios eliminados: ${userRes.deletedCount ?? 0}`)
        }

        console.log('\n🎉 Reset completado.\n')
    } finally {
        await conn.close().catch(() => {})
    }
}

main().catch((err) => {
    console.error('❌ Error en resetTenant:', err)
    process.exitCode = 1
})

