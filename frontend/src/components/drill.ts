import type { TreeRow } from '../api'
import { query } from '../api'

/** Link from a report cell to the Cash flow rows behind it. */
export function cashflowLink(row: TreeRow, from: string, to: string, accountId: number | null): string {
  const base = { from, to, cash: 'cash', account: accountId ?? undefined }
  if (row.type === 'ПЕРЕВОД') return `/cash-flow${query({ ...base, kind: 'ПЕРЕВОД', account: row.account_id })}`
  const scope = row.level === 2 && row.article_id ? { article: row.article_id } : { kind: row.type, category: row.category }
  return `/cash-flow${query({ ...base, ...scope })}`
}

export function pnlLink(row: TreeRow, month: string, isPlan = false): string {
  const scope = row.level === 2 && row.article_id ? { article: row.article_id } : { kind: row.type, category: row.category }
  return `${isPlan ? '/pnl-reja' : '/cash-flow'}${query({ pnl: month, ...scope })}`
}
