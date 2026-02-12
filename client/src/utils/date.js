export const APP_TIMEZONE = 'America/Argentina/Buenos_Aires'

// Returns YYYY-MM-DD in Argentina timezone (sv-SE locale outputs YYYY-MM-DD)
export function getYMDArgentina(dateLike) {
  if (!dateLike) return null
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return null
  try {
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(d)
  } catch {
    return d.toISOString().split('T')[0]
  }
}

export function moneyToCents(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100)
}

