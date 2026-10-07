export const MONTHS = ['ЯНВАРЬ', 'ФЕВРАЛЬ', 'МАРТ', 'АПРЕЛЬ', 'МАЙ', 'ИЮНЬ', 'ИЮЛЬ', 'АВГУСТ', 'СЕНТЯБРЬ', 'ОКТЯБРЬ', 'НОЯБРЬ', 'ДЕКАБРЬ']

/** 1234567.5 → "1 234 568" (Excel-like, no decimals). */
export function money(value: number | null | undefined, empty = ''): string {
  if (value === null || value === undefined || Number.isNaN(value)) return empty
  const rounded = Math.round(value)
  const sign = rounded < 0 ? '−' : ''
  return sign + Math.abs(rounded).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** Like money() but keeps up to 2 decimals (USD, rates). */
export function decimal(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const [int, frac] = Math.abs(value).toFixed(2).split('.')
  const body = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (frac === '00' ? '' : ',' + frac.replace(/0$/, ''))
  return (value < 0 ? '−' : '') + body
}

export function percent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '–'
  return `${(value * 100).toFixed(0)}%`
}

/** Parse user input like "1 234 567,50" or "1234567.5". Returns null for empty input. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[\s ]/g, '').replace(/−/g, '-')
  if (!cleaned) return null
  const normalized = cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  const n = Number(normalized)
  return Number.isFinite(n) ? n : NaN
}

/** "2026-08-03" → "03.08.2026" */
export function dmy(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}.${m}.${y}`
}

/** "2026-08-01" → "АВГУСТ 2026" */
export function monthLabel(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m] = iso.split('-')
  return `${MONTHS[Number(m) - 1]} ${y}`
}

export function todayIso(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function monthIso(iso: string): string {
  return iso.slice(0, 7)
}

export function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` }
}

export function signClass(value: number | null | undefined): string {
  if (!value) return ''
  return value < 0 ? 'text-rose-600' : ''
}
