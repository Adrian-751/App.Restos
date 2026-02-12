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
    // sv-SE => YYYY-MM-DD
    const fmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return fmt.format(d)
  } catch {
    // Fallback UTC
    return d.toISOString().split('T')[0]
  }
}
