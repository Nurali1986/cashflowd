import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TreeRow } from '../api'
import { money } from '../format'
import { Toggle } from '../ui'

export interface MatrixColumn {
  label: string
  sub?: string
  /** Value of a tree row in this column. */
  value: (row: TreeRow) => number
  className?: string
  link?: (row: TreeRow) => string | null
}

export interface SummaryRow {
  label: string
  values: (number | null)[]
  total?: number | null
  tone?: 'sum' | 'muted' | 'strong'
}

/** Spreadsheet-like report: summary rows on top, then the category → subcategory tree. */
export default function TreeMatrix({ columns, rows, summary, totalLabel = 'ИТОГО', rowTotal, onNavigate }: {
  columns: MatrixColumn[]
  rows: TreeRow[]
  summary: SummaryRow[]
  totalLabel?: string
  rowTotal: (row: TreeRow) => number
  onNavigate?: (url: string) => void
}) {
  const [hideZero, setHideZero] = useState(true)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [allOpen, setAllOpen] = useState(true)

  const visible = useMemo(() => {
    const out: TreeRow[] = []
    let parentKey = ''
    for (const r of rows) {
      const nonZero = columns.some(c => Math.abs(c.value(r)) > 0.004) || Math.abs(rowTotal(r)) > 0.004
      if (r.level === 1) parentKey = `${r.type}|${r.category}`
      if (hideZero && !nonZero) continue
      if (r.level === 2 && (collapsed.has(parentKey) || !allOpen)) continue
      out.push(r)
    }
    return out
  }, [rows, columns, hideZero, collapsed, allOpen, rowTotal])

  const toggle = (key: string) => setCollapsed(s => {
    const n = new Set(s)
    if (n.has(key)) n.delete(key)
    else n.add(key)
    return n
  })

  const typeHeader = (type: string) => type === 'ДОХОД' ? 'ДОХОДЫ' : type === 'РАСХОД' ? 'РАСХОДЫ' : 'ПЕРЕВОДЫ'
  let lastType = ''

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-3 py-2">
        <Toggle checked={hideZero} onChange={setHideZero} label="Nol qatorlarni yashirish" />
        <Toggle checked={allOpen} onChange={v => { setAllOpen(v); setCollapsed(new Set()) }} label="Podkategoriyalarni ko'rsatish" />
      </div>
      <div className="max-h-[72vh] overflow-auto">
        <table className="sheet w-max min-w-full">
          <thead>
            <tr>
              <th className="sticky-col min-w-[280px]">Статья</th>
              <th className="num bg-emerald-50">{totalLabel}</th>
              {columns.map((c, i) => (
                <th key={i} className={`num ${c.className ?? ''}`}>
                  {c.label}
                  {c.sub && <div className="text-[10px] font-normal text-slate-400">{c.sub}</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {summary.map(s => (
              <tr key={s.label} className={s.tone === 'sum' || s.tone === 'strong' ? 'sum' : ''}>
                <td className={`sticky-col ${s.tone === 'muted' ? 'text-slate-500' : 'font-semibold'}`}>{s.label}</td>
                <td className="num bg-emerald-50 font-semibold">{s.total === undefined ? '' : s.total === null ? '–' : <span className={s.total < 0 ? 'text-rose-600' : ''}>{money(s.total)}</span>}</td>
                {s.values.map((v, i) => (
                  <td key={i} className={`num ${columns[i]?.className ?? ''} ${v === 0 ? 'zero' : ''}`}>
                    {v === null ? '–' : <span className={v < 0 ? 'text-rose-600' : ''}>{money(v)}</span>}
                  </td>
                ))}
              </tr>
            ))}
            {visible.map(r => {
              const header = r.type !== lastType ? typeHeader(r.type) : null
              lastType = r.type
              const parentKey = `${r.type}|${r.category}`
              const total = rowTotal(r)
              return [
                header && (
                  <tr key={`h-${r.type}`}>
                    <td className={`sticky-col pt-4 text-xs font-bold uppercase tracking-wide ${r.type === 'ДОХОД' ? 'text-emerald-700' : r.type === 'РАСХОД' ? 'text-rose-700' : 'text-sky-700'}`}>{header}</td>
                    <td colSpan={columns.length + 1}></td>
                  </tr>
                ),
                <tr key={r.key} className={r.level === 1 ? 'cat' : ''}>
                  <td className="sticky-col">
                    {r.level === 1 ? (
                      <button className="flex items-center gap-1 text-left" onClick={() => toggle(parentKey)}>
                        {collapsed.has(parentKey) || !allOpen ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {r.label}
                      </button>
                    ) : <span className="pl-6 text-slate-700">{r.label}</span>}
                  </td>
                  <td className={`num bg-emerald-50/60 ${total === 0 ? 'zero' : ''}`}><span className={total < 0 ? 'text-rose-600' : ''}>{money(total)}</span></td>
                  {columns.map((c, i) => {
                    const v = c.value(r)
                    const href = v && c.link ? c.link(r) : null
                    return (
                      <td key={i} className={`num ${c.className ?? ''} ${v === 0 ? 'zero' : ''}`}>
                        {href && onNavigate ? (
                          <button className={`hover:underline ${v < 0 ? 'text-rose-600' : ''}`} onClick={() => onNavigate(href)}>{money(v)}</button>
                        ) : <span className={v < 0 ? 'text-rose-600' : ''}>{money(v)}</span>}
                      </td>
                    )
                  })}
                </tr>,
              ]
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
