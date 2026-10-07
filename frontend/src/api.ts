export type Kind = 'ДОХОД' | 'РАСХОД' | 'ПЕРЕВОД'

export interface Account { id: number; name: string; opening_balance: number; sort: number }
export interface Article { id: number; type: Kind; category: string; subcategory: string | null; full_name: string; sort?: number; usage?: number }
export interface ProjectRef { id: number; name: string; customer: string | null; close_date: string | null }
export interface DirectoryItem { id: number; kind: 'customer' | 'order_category'; name: string; sort: number }

export interface Settings { start_date: string; pnl_use_close_date: string; company_name: string }

export interface Meta {
  settings: Settings
  months: string[]
  years: number[]
  today: string
  accounts: Account[]
  articles: Article[]
  projects: ProjectRef[]
  directory: DirectoryItem[]
  statuses: string[]
}

export interface Transaction {
  id: number
  is_plan: boolean
  date: string | null
  pnl_month: string | null
  pnl_month_label: string
  effective_pnl_label: string
  cf_month_label: string
  kind: Kind | null
  article_id: number | null
  article_name: string | null
  category: string | null
  account_id: number | null
  account_name: string | null
  to_account_id: number | null
  to_account_name: string | null
  usd: number | null
  usd_rate: number | null
  amount: number
  project_id: number | null
  project_name: string | null
  project_close_date: string | null
  comment: string | null
  import_warning: string | null
}

export interface TransactionInput {
  is_plan: boolean
  date: string | null
  pnl_month: string | null
  article_id: number | null
  account_id: number | null
  to_account_id: number | null
  usd: number | null
  usd_rate: number | null
  amount: number | null
  project_name: string | null
  comment: string | null
  transfer: boolean
}

export interface TransactionPage {
  items: Transaction[]
  total: number
  sum_income: number
  sum_expense: number
  sum_transfer: number
}

export interface Project {
  id: number
  order_date: string | null
  name: string
  customer: string | null
  description: string | null
  category: string | null
  contract_amount: number | null
  status: string | null
  close_date: string | null
  comment: string | null
  paid: number
  debt: number
  expenses: number
  margin: number
  profitability: number | null
  operations: number
  duplicate: boolean
  close_error: boolean
}

export type ProjectInput = Omit<Project, 'id' | 'paid' | 'debt' | 'expenses' | 'margin' | 'profitability' | 'operations' | 'duplicate' | 'close_error'>

export interface Rate { id: number; date: string; rate: number }

export interface TreeRow {
  key: string
  level: 1 | 2
  type: Kind
  label: string
  category: string
  article_id: number | null
  account_id: number | null
  values: number[]
  total: number
  plan?: number[]
  plan_total?: number
}

export interface CashflowReport {
  columns: { from: string; to: string }[]
  labels: string[]
  summary: {
    opening: (number | null)[]
    closing: (number | null)[]
    income: number[]
    expense: number[]
    net: number[]
    transfers: number[]
    total_opening: number | null
    total_closing: number | null
  }
  rows: TreeRow[]
  year?: number
  month?: string
  month_label?: string
}

export interface PnlReport {
  year: number
  labels: string[]
  summary: {
    income: number[]
    expense: number[]
    profit: number[]
    plan_income: number[]
    plan_expense: number[]
    plan_profit: number[]
  }
  rows: TreeRow[]
}

export interface KassaRow {
  account_id: number
  account: string
  opening_balance: number
  balance: number
  balance_usd: number | null
  period_income: number
  period_expense: number
  period_transfers: number
  period_balance: number
}

export interface KassaReport {
  today: string
  rate: number | null
  date_from: string | null
  date_to: string | null
  start_date: string
  rows: KassaRow[]
  total: { balance: number; balance_usd: number | null; period_income: number; period_expense: number; period_balance: number }
  unassigned: { count: number; net: number }
}

export class ApiError extends Error {}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: {} }
  if (body instanceof FormData) {
    init.body = body
  } else if (body !== undefined) {
    init.body = JSON.stringify(body)
    init.headers = { 'Content-Type': 'application/json' }
  }
  const res = await fetch(url, init)
  if (!res.ok) {
    let message = `Xatolik (${res.status})`
    try {
      const data = await res.json()
      if (typeof data.detail === 'string') message = data.detail
      else if (Array.isArray(data.detail)) message = data.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch { /* not JSON */ }
    throw new ApiError(message)
  }
  return res.json() as Promise<T>
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== null && v !== undefined && v !== '' && v !== false) q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
}
