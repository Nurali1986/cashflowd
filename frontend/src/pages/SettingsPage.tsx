import { Link } from 'react-router-dom'
import { MONTHS, money } from '../format'
import { useMeta } from '../meta'
import { Card, MODES, PageHeader } from '../ui'

/** настройки: technical lists the workbook derives from справочник — read-only here, edit them in справочник. */
export default function SettingsPage() {
  const { meta } = useMeta()
  const income = meta.articles.filter(a => a.type === 'ДОХОД')
  const expense = meta.articles.filter(a => a.type === 'РАСХОД')
  const count = (list: typeof income) => new Set(list.map(a => a.category)).size
  const pairs = meta.accounts.flatMap(a => meta.accounts.filter(b => b.id !== a.id).map(b => `ПЕРЕВОД. ${a.name} → ${b.name}`))
  const current = meta.projects.filter(p => !p.close_date)

  return (
    <div className="space-y-4">
      <PageHeader title="настройки" subtitle={<>Platforma avtomatik hisoblaydigan ro'yxatlar (Excel'dagi «настройки» varag'i). O'zgartirish uchun <Link className="text-sky-600 underline" to="/spravochnik">справочник</Link> sahifasiga o'ting.</>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[['ДОХОДЫ: kategoriyalar', count(income)], ['ДОХОДЫ: статьялар', income.length], ['РАСХОДЫ: kategoriyalar', count(expense)], ['РАСХОДЫ: статьялар', expense.length], ['кол-во счетов', meta.accounts.length]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white px-4 py-3"><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-semibold">{v}</div></div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card title="Oylar">
          <table className="sheet w-full"><tbody>{MONTHS.map((m, i) => <tr key={m}><td className="w-10 text-slate-400">{i + 1}</td><td>{m}</td></tr>)}</tbody></table>
        </Card>
        <Card title="всего денег на начало">
          <table className="sheet w-full"><tbody>
            <tr className="sum"><td>ВСЕ СЧЕТА</td><td className="num">{money(meta.accounts.reduce((s, a) => s + a.opening_balance, 0))}</td></tr>
            {meta.accounts.map(a => <tr key={a.id}><td>{a.name}</td><td className="num">{money(a.opening_balance)}</td></tr>)}
          </tbody></table>
          <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">Hisobot filtrlari: {MODES.map(m => m.label).join(' · ')}</div>
        </Card>
        <Card title="ПЕРЕВОДЫ МЕЖДУ СЧЕТАМИ">
          <ul className="max-h-80 divide-y divide-slate-100 overflow-auto text-sm">{pairs.map(p => <li key={p} className="px-4 py-1.5">{p}</li>)}</ul>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title={`для выпадающего списка (${meta.articles.length})`}>
          <ul className="max-h-[520px] divide-y divide-slate-100 overflow-auto text-sm">{meta.articles.map(a => <li key={a.id} className="px-4 py-1.5">{a.full_name}</li>)}</ul>
        </Card>
        <Card title={`ТЕКУЩИЕ ПРОЕКТЫ (yopilmagan: ${current.length})`}>
          <ul className="max-h-[520px] divide-y divide-slate-100 overflow-auto text-sm">{current.map(p => <li key={p.id} className="flex justify-between px-4 py-1.5"><Link className="hover:underline" to={`/otchet/${p.id}`}>{p.name}</Link><span className="text-slate-400">{p.customer}</span></li>)}</ul>
        </Card>
      </div>
    </div>
  )
}
