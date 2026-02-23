/**
 * Recalcular totales de una caja (efectivo/transferencia) para una fecha, por tenant.
 *
 * Útil si el server estuvo caído y se desincronizaron los acumulados de Caja.
 *
 * Uso:
 *   node scripts/recalcularCajaFecha.js --tenant default --fecha 2026-02-12 --confirm
 *
 * Opcionales:
 *   --dry-run   (no guarda, solo imprime)
 */

import dotenv from 'dotenv'
dotenv.config()

import { getTenantConnection } from '../tenancy/connectionManager.js'
import { getModels } from '../tenancy/models.js'
import { formatDateYMD } from '../utils/date.js'

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

const toMoney = (n) => {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  // Mantener 2 decimales para dinero
  return Math.round((x + Number.EPSILON) * 100) / 100
}

const main = async () => {
  const args = parseArgs(process.argv.slice(2))
  const tenant = String(args.tenant || '').trim().toLowerCase()
  const fecha = String(args.fecha || '').trim()
  const dryRun = !!args['dry-run']
  const confirm = !!args.confirm

  if (!tenant) {
    console.error('❌ Falta --tenant <name>')
    process.exitCode = 1
    return
  }
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    console.error('❌ Falta --fecha YYYY-MM-DD (ej: 2026-02-12)')
    process.exitCode = 1
    return
  }
  if (!dryRun && !confirm) {
    console.error('⚠️  Por seguridad, este script NO escribe sin --confirm (o usa --dry-run).')
    process.exitCode = 2
    return
  }

  const conn = await getTenantConnection(tenant)
  const { Caja, Pedido, Turno } = getModels(conn)

  try {
    const caja = await Caja.findOne({ fecha, cerrada: false }).sort({ createdAt: -1 })
    if (!caja) {
      console.error(`❌ No hay caja ABIERTA para fecha=${fecha} (tenant=${tenant}).`)
      console.error('   Si la caja está cerrada, abrila (o reabrila) y re-ejecutá el script.')
      process.exitCode = 3
      return
    }

    // Rango local para reducir query; igual validamos por formatDateYMD (America/Argentina/Buenos_Aires)
    const start = new Date(`${fecha}T00:00:00`)
    const end = new Date(`${fecha}T23:59:59.999`)

    const [pedidos, turnos] = await Promise.all([
      Pedido.find({ createdAt: { $gte: start, $lte: end }, estado: { $ne: 'Cancelado' } }),
      Turno.find({ createdAt: { $gte: start, $lte: end }, estado: { $ne: 'Cancelado' } }),
    ])

    let efectivoSum = 0
    let transferenciaSum = 0

    for (const p of pedidos) {
      if (formatDateYMD(p.createdAt) !== fecha) continue
      efectivoSum += Number(p.efectivo || 0)
      transferenciaSum += Number(p.transferencia || 0)
    }
    for (const t of turnos) {
      if (formatDateYMD(t.createdAt) !== fecha) continue
      efectivoSum += Number(t.efectivo || 0)
      transferenciaSum += Number(t.transferencia || 0)
    }

    efectivoSum = toMoney(efectivoSum)
    transferenciaSum = toMoney(transferenciaSum)

    console.log('\n📦 Caja encontrada:')
    console.log(`- id: ${caja._id}`)
    console.log(`- fecha: ${caja.fecha}`)
    console.log(`- cerrada: ${caja.cerrada}`)
    console.log('\n🔢 Totales actuales:')
    console.log(`- totalEfectivo: ${toMoney(caja.totalEfectivo || 0)}`)
    console.log(`- totalTransferencia: ${toMoney(caja.totalTransferencia || 0)}`)
    console.log('\n🧮 Totales recalculados (desde Pedido/Turno del día, incluyendo pagos parciales):')
    console.log(`- totalEfectivo: ${efectivoSum}`)
    console.log(`- totalTransferencia: ${transferenciaSum}`)
    console.log(`- pedidos considerados: ${pedidos.length}`)
    console.log(`- turnos considerados: ${turnos.length}`)

    if (dryRun) {
      console.log('\n🧪 Dry-run: no se guardó nada.\n')
      return
    }

    caja.totalEfectivo = efectivoSum
    caja.totalTransferencia = transferenciaSum
    await caja.save()

    console.log('\n✅ Caja actualizada.\n')
  } finally {
    await conn.close().catch(() => { })
  }
}

main().catch((err) => {
  console.error('❌ Error en recalcularCajaFecha:', err)
  process.exitCode = 1
})

