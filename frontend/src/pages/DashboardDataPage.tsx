import { useState } from 'react'
import { query, type CashflowReport, type PnlReport } from '../api'
import { MONTHS, money } from '../format'
import { useData } from '../meta'
import { Card, PageHeader, Spinner, YearSelect } from '../ui'

/** настройки(дашбордОПУ / дашбордДДС): the data tables behind the dashboards. */
export default function DashboardDataPage({ variant }: { variant: 'pnl' | 'cashflow' }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const { data } = useData<PnlReport | CashflowReport>(variant === 'pnl'
    ? `/api/reports/pnl-monthly${query({ year })}` : `/api/reports/cashflow-monthly${query({ year })}`)
  const cats = data ? data.rows.filter(r => r.level === 1 && r.type !== 'ПЕРЕВОД') : []

  return (
    <div className="space-y-4">
      <PageHeader title={variant === 'pnl' ? 'настройки(дашбордОПУ)' : 'настройки(дашбордДДС)'}
        subtitle={`«${variant === 'pnl' ? 'Dashboard P&L' : 'Dashboard Cash flow'}» grafiklari uchun hisoblangan jadvallar.`}>
        <YearSelect value={year} onChange={setYear} />
      </PageHeader>
      {!data ? <Spinner /> : (
        <>
          <Card title="Oylar bo'yicha">
            <div className="overflow-auto">
              <table className="sheet w-full">
                <thead><tr><th>Oy</th><th className="num">ДОХОД</th><th className="num">РАСХОД</th><th className="num">ПРИБЫЛЬ</th></tr></thead>
                <tbody>{MONTHS.map((m, i) => (
                  <tr key={m}><td>{m}</td><td className="num">{money(data.summary.income[i])}</td><td className="num">{money(data.summary.expense[i])}</td>
                    <td className="num font-medium">{money(data.summary.income[i] - data.summary.expense[i])}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Card>
          <Card title="Kategoriyalar bo'yicha (yil)">
            <div className="overflow-auto">
              <table className="sheet w-full">
                <thead><tr><th>Turi</th><th>КАТЕГОРИЯ</th><th className="num">Jami</th><th className="num">Ulush</th>{MONTHS.map(m => <th key={m} className="num">{m.slice(0, 3)}</th>)}</tr></thead>
                <tbody>{cats.map(r => {
                  const typeTotal = cats.filter(c => c.type === r.type).reduce((s, c) => s + c.total, 0)
                  return (
                    <tr key={r.key}><td>{r.type}</td><td>{r.label}</td><td className="num font-medium">{money(r.total)}</td>
                      <td className="num text-slate-500">{typeTotal ? `${((r.total / typeTotal) * 100).toFixed(1)}%` : ''}</td>
                      {r.values.map((v, i) => <td key={i} className={`num ${v ? '' : 'zero'}`}>{money(v)}</td>)}</tr>
                  )
                })}</tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
