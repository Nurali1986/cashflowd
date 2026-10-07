import { useState } from 'react'
import { query, type TransactionPage } from '../api'
import { monthBounds, monthIso, money, todayIso } from '../format'
import { useData, useMeta } from '../meta'
import TransactionTable from '../components/TransactionTable'
import { Card, Empty, Field, Input, PageHeader, Spinner } from '../ui'

/** Back-end: Cash flow rows filtered by a date range (the Excel sheet fed the Kassa period block). */
export default function BackendPage() {
  const { meta } = useMeta()
  const initial = monthBounds(monthIso(todayIso()))
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const { data } = useData<TransactionPage>(`/api/transactions${query({ date_from: from, date_to: to, limit: 5000, sort: 'date_asc' })}`)

  const byAccount = meta.accounts.map(a => {
    const rows = data?.items.filter(t => t.account_id === a.id) ?? []
    return {
      name: a.name,
      income: rows.filter(t => t.kind === 'ДОХОД').reduce((s, t) => s + t.amount, 0),
      expense: rows.filter(t => t.kind === 'РАСХОД').reduce((s, t) => s + t.amount, 0),
    }
  })

  return (
    <div className="space-y-4">
      <PageHeader title="Back-end" subtitle="Tanlangan davrdagi Cash flow operatsiyalari (faqat ko'rish uchun).">
        <Field label="dan"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
        <Field label="gacha"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
      </PageHeader>
      <Card title="Hisoblar bo'yicha">
        <table className="sheet w-full">
          <thead><tr><th>СЧЕТ</th><th className="num">ДОХОД</th><th className="num">РАСХОД</th><th className="num">Farq</th></tr></thead>
          <tbody>{byAccount.map(r => (
            <tr key={r.name}><td>{r.name}</td><td className="num">{money(r.income)}</td><td className="num">{money(r.expense)}</td><td className="num font-medium">{money(r.income - r.expense)}</td></tr>
          ))}</tbody>
        </table>
      </Card>
      <Card title={data ? `Operatsiyalar: ${data.total}` : 'Operatsiyalar'}>
        {!data ? <Spinner /> : data.items.length === 0 ? <Empty>#N/A — bu davrda operatsiya yo'q</Empty> : <TransactionTable rows={data.items} />}
      </Card>
    </div>
  )
}
