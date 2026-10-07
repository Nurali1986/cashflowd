import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { query, type CashflowReport } from '../api'
import { useData } from '../meta'
import TreeMatrix from '../components/TreeMatrix'
import { cashflowLink } from '../components/drill'
import { AccountSelect, Card, ErrorBox, ModeSelect, PageHeader, Spinner, YearSelect } from '../ui'

export default function CashflowMonthlyPage() {
  const navigate = useNavigate()
  const [year, setYear] = useState(new Date().getFullYear())
  const [account, setAccount] = useState<number | null>(null)
  const [mode, setMode] = useState('all')
  const { data, error } = useData<CashflowReport>(`/api/reports/cashflow-monthly${query({ year, account_id: account, mode })}`)

  return (
    <div className="space-y-4">
      <PageHeader title="Cash flow oylik" subtitle="Pul oqimi (ДДС) oylar bo'yicha: sanali operatsiyalar, operatsiya sanasi bo'yicha.">
        <YearSelect value={year} onChange={setYear} />
        <AccountSelect value={account} onChange={setAccount} />
        <ModeSelect value={mode} onChange={setMode} />
      </PageHeader>
      <ErrorBox message={error} />
      <Card>
        {!data ? <Spinner /> : (
          <TreeMatrix
            columns={data.labels.map((label, i) => ({
              label,
              value: r => r.values[i],
              link: r => cashflowLink(r, data.columns[i].from, data.columns[i].to, account),
            }))}
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
      {mode !== 'all' && <p className="text-xs text-slate-500">Saldo (qoldiq) faqat «ВСЕ ОПЕРАЦИИ» rejimida hisoblanadi — Excel'dagi kabi.</p>}
    </div>
  )
}
