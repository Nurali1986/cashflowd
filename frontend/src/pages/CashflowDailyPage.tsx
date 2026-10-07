import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { query, type CashflowReport } from '../api'
import { monthIso, todayIso } from '../format'
import { useData } from '../meta'
import TreeMatrix from '../components/TreeMatrix'
import { cashflowLink } from '../components/drill'
import { AccountSelect, Card, ErrorBox, Input, ModeSelect, PageHeader, Spinner } from '../ui'

const WEEKDAYS = ['Ya', 'Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh']

export default function CashflowDailyPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(monthIso(todayIso()))
  const [account, setAccount] = useState<number | null>(null)
  const [mode, setMode] = useState('all')
  const { data, error } = useData<CashflowReport>(`/api/reports/cashflow-daily${query({ month, account_id: account, mode })}`)

  return (
    <div className="space-y-4">
      <PageHeader title="Cash flow kunlik" subtitle={`Tanlangan oy kunlari bo'yicha pul oqimi${data?.month_label ? ` — ${data.month_label}` : ''}.`}>
        <Input type="month" value={month} onChange={e => e.target.value && setMonth(e.target.value)} className="w-40" />
        <AccountSelect value={account} onChange={setAccount} />
        <ModeSelect value={mode} onChange={setMode} />
      </PageHeader>
      <ErrorBox message={error} />
      <Card>
        {!data ? <Spinner /> : (
          <TreeMatrix
            columns={data.columns.map((c, i) => {
              const d = new Date(`${c.from}T00:00:00`)
              const weekend = d.getDay() === 0
              return {
                label: data.labels[i],
                sub: WEEKDAYS[d.getDay()],
                className: weekend ? 'bg-slate-50' : '',
                value: r => r.values[i],
                link: r => cashflowLink(r, c.from, c.to, account),
              }
            })}
            rows={data.rows}
            rowTotal={r => r.total}
            onNavigate={navigate}
            summary={[
              { label: 'САЛЬДО НАЧАЛЬНОЕ', values: data.summary.opening, total: data.summary.total_opening, tone: 'muted' },
              { label: 'САЛЬДО КОНЕЧНОЕ', values: data.summary.closing, total: data.summary.total_closing, tone: 'strong' },
              { label: 'ДОХОДЫ', values: data.summary.income, total: data.summary.income.reduce((a, b) => a + b, 0) },
              { label: 'РАСХОДЫ', values: data.summary.expense, total: data.summary.expense.reduce((a, b) => a + b, 0) },
              { label: 'ДОХОДЫ − РАСХОДЫ', values: data.summary.net, total: data.summary.net.reduce((a, b) => a + b, 0), tone: 'sum' },
              ...(account ? [{ label: 'ПЕРЕВОДЫ', values: data.summary.transfers, total: data.summary.transfers.reduce((a, b) => a + b, 0) }] : []),
            ]}
          />
        )}
      </Card>
    </div>
  )
}
