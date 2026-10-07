import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { query, type PnlReport } from '../api'
import { MONTHS } from '../format'
import { useData, useMeta } from '../meta'
import TreeMatrix, { type MatrixColumn } from '../components/TreeMatrix'
import { pnlLink } from '../components/drill'
import { Card, ErrorBox, ModeSelect, PageHeader, Spinner, Toggle, YearSelect } from '../ui'

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export default function PnlMonthlyPage() {
  const navigate = useNavigate()
  const { meta } = useMeta()
  const [year, setYear] = useState(new Date().getFullYear())
  const [mode, setMode] = useState('all')
  const [showPlan, setShowPlan] = useState(false)
  const { data, error } = useData<PnlReport>(`/api/reports/pnl-monthly${query({ year, mode: mode === 'company' ? 'company' : mode })}`)

  const columns: MatrixColumn[] = []
  if (data) {
    MONTHS.forEach((m, i) => {
      const ym = `${year}-${String(i + 1).padStart(2, '0')}`
      if (showPlan) columns.push({ label: 'План', sub: m, className: 'bg-amber-50/60 text-slate-500', value: r => r.plan?.[i] ?? 0, link: r => pnlLink(r, ym, true) })
      columns.push({ label: m, sub: showPlan ? 'Факт' : String(year), value: r => r.values[i], link: r => pnlLink(r, ym) })
    })
  }
  const interleave = (fact: number[], plan: number[]) => MONTHS.flatMap((_, i) => (showPlan ? [plan[i], fact[i]] : [fact[i]]))

  return (
    <div className="space-y-4">
      <PageHeader title="P&L oylik" subtitle={
        meta.settings.pnl_use_close_date === '1'
          ? "Foyda va zarar (ОПУ). Loyiha operatsiyalari loyiha yopilgan oyga yoziladi (справочник sozlamasi)."
          : "Foyda va zarar (ОПУ): «Qaysi oy uchun (P&L)» ustuni bo'yicha. Sanasiz hisoblash qatorlari ham kiradi."}>
        <YearSelect value={year} onChange={setYear} />
        <ModeSelect value={mode} onChange={setMode} />
        <Toggle checked={showPlan} onChange={setShowPlan} label="Reja (План) ustunlari" />
      </PageHeader>
      <ErrorBox message={error} />
      <Card>
        {!data ? <Spinner /> : (
          <TreeMatrix
            columns={columns}
            rows={data.rows}
            rowTotal={r => r.total}
            totalLabel={`ИТОГО ${year}`}
            onNavigate={navigate}
            summary={[
              { label: 'ДОХОДЫ', values: interleave(data.summary.income, data.summary.plan_income), total: sum(data.summary.income) },
              { label: 'РАСХОДЫ', values: interleave(data.summary.expense, data.summary.plan_expense), total: sum(data.summary.expense) },
              { label: 'ЧИСТАЯ ПРИБЫЛЬ', values: interleave(data.summary.profit, data.summary.plan_profit), total: sum(data.summary.profit), tone: 'strong' },
            ]}
          />
        )}
      </Card>
    </div>
  )
}
