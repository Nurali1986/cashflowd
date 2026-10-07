import { useState } from 'react'
import { Link } from 'react-router-dom'
import { query, type KassaReport } from '../api'
import { decimal, dmy, monthBounds, monthIso, todayIso } from '../format'
import { useData } from '../meta'
import { Card, ErrorBox, Field, Input, Money, PageHeader, Spinner, Stat } from '../ui'

export default function KassaPage() {
  const initial = monthBounds(monthIso(todayIso()))
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const { data, error } = useData<KassaReport>(`/api/reports/kassa${query({ date_from: from, date_to: to })}`)

  return (
    <div className="space-y-4">
      <PageHeader title="Kassa" subtitle="Har bir hisob (СЧЕТ) bo'yicha joriy qoldiq: boshlang'ich summa + ДОХОД − РАСХОД ± ПЕРЕВОД." />
      <ErrorBox message={error} />
      {!data ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label="ТЕКУЩИЙ БАЛАНС (ИТОГО)" value={<Money value={data.total.balance} />} hint={`Bugun: ${dmy(data.today)}`} />
            <Stat label="Dollarda" value={data.total.balance_usd === null ? '—' : `$ ${decimal(data.total.balance_usd)}`}
              hint={data.rate ? `Kurs: ${decimal(data.rate)}` : <Link className="underline" to="/kurs">Kurs kiritilmagan</Link>} tone="blue" />
            <Stat label="Hisoblar soni" value={data.rows.length} hint={`Hisob boshlanish sanasi: ${dmy(data.start_date)}`} />
          </div>

          <Card title="Joriy qoldiq">
            <div className="overflow-auto">
              <table className="sheet w-full">
                <thead>
                  <tr><th>СЧЕТ</th><th className="num">Boshlang'ich summa</th><th className="num">ТЕКУЩИЙ БАЛАНС</th><th className="num">$ (USD)</th><th></th></tr>
                </thead>
                <tbody>
                  <tr className="sum">
                    <td>ИТОГО</td>
                    <td className="num"><Money value={data.rows.reduce((s, r) => s + r.opening_balance, 0)} /></td>
                    <td className="num"><Money value={data.total.balance} /></td>
                    <td className="num">{decimal(data.total.balance_usd)}</td>
                    <td></td>
                  </tr>
                  {data.rows.map(r => (
                    <tr key={r.account_id}>
                      <td className="font-medium">{r.account}</td>
                      <td className="num"><Money value={r.opening_balance} /></td>
                      <td className="num font-semibold"><Money value={r.balance} /></td>
                      <td className="num">{decimal(r.balance_usd)}</td>
                      <td className="text-right"><Link className="text-xs text-sky-600 hover:underline" to={`/cash-flow?account=${r.account_id}&cash=cash`}>operatsiyalar →</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.unassigned.count > 0 && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs text-amber-700">
                ⚠ {data.unassigned.count} ta sanali operatsiyada СЧЕТ ko'rsatilmagan (jami <Money value={data.unassigned.net} />) — ular balansga kirmaydi (Excel'dagi kabi).{' '}
                <Link className="underline" to="/cash-flow?warnings=1">Tuzatish</Link>
              </p>
            )}
          </Card>

          <Card title="Davr bo'yicha (Back-end)" actions={
            <div className="flex items-end gap-2">
              <Field label="dan"><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
              <Field label="gacha"><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
            </div>
          }>
            <div className="overflow-auto">
              <table className="sheet w-full">
                <thead>
                  <tr><th>СЧЕТ</th><th className="num">ДОХОД</th><th className="num">РАСХОД</th><th className="num">ПЕРЕВОД</th><th className="num">Boshlang'ich + davr harakati</th></tr>
                </thead>
                <tbody>
                  <tr className="sum">
                    <td>ИТОГО</td>
                    <td className="num"><Money value={data.total.period_income} /></td>
                    <td className="num"><Money value={data.total.period_expense} /></td>
                    <td className="num"></td>
                    <td className="num"><Money value={data.total.period_balance} /></td>
                  </tr>
                  {data.rows.map(r => (
                    <tr key={r.account_id}>
                      <td className="font-medium">{r.account}</td>
                      <td className="num text-emerald-700"><Money value={r.period_income} /></td>
                      <td className="num text-rose-700"><Money value={r.period_expense} /></td>
                      <td className="num"><Money value={r.period_transfers} /></td>
                      <td className="num font-semibold"><Money value={r.period_balance} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
