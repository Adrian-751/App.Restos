export function getTodayYMD(timeZone = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires') {
  try {
    // sv-SE => YYYY-MM-DD
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(new Date())
  } catch {
    // Fallback UTC
    return new Date().toISOString().split('T')[0]
  }
}

export function formatDateYMD(date, timeZone = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires') {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  try {
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(d)
  } catch {
    return d.toISOString().split('T')[0]
  }
}

/**
 * Devuelve HH:mm:ss para un Date dado, formateado en el timezone indicado.
 * Útil cuando el server corre en UTC (Render) pero queremos timestamps "Argentina"
 * al construir createdAt a partir de una fecha YYYY-MM-DD.
 */
export function getTimeHMS(date = new Date(), timeZone = process.env.APP_TIMEZONE || 'America/Argentina/Buenos_Aires') {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return '00:00:00'
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d)

    const get = (type) => parts.find((p) => p.type === type)?.value
    const hh = get('hour') ?? '00'
    const mm = get('minute') ?? '00'
    const ss = get('second') ?? '00'
    return `${hh}:${mm}:${ss}`
  } catch {
    // Fallback: hora del server
    return d.toTimeString().slice(0, 8)
  }
}

/**
 * Offset fijo Argentina (UTC-3). Argentina no usa DST actualmente.
 * Se usa para parsear YYYY-MM-DDTHH:mm:ss con un offset explícito y evitar
 * que el motor JS lo interprete con el timezone del servidor (p.ej. UTC).
 */
export function getArgentinaOffset() {
  return '-03:00'
}