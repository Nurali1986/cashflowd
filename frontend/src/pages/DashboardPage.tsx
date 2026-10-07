import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { query, type CashflowReport, type KassaReport, type PnlReport, type Project, type TreeRow } from '../api'
import { MONTHS, decimal, dmy, money } from '../format'
import { useData } from '../meta'
import { AccountSelect, Card, ErrorBox, Field, Money, PageHeader, Select, Spinner, Stat, Toggle, YearSelect } from '../ui'

// Validated categorical slots 1–3 (blue, orange, aqua) — income, expense, profit.
const C_INCOME = '#2a78d6'
const C_EXPENSE = '#eb6834'
const C_PROFIT = '#1baf7a'

const compact = (v: number) => {
  const a = Math.abs(v)
  if (a >= 1e9) return `${(v / 1e9).toFixed(1)} mlrd`
  if (a >= 1e6) return `${(v / 1e6).toFixed(0)} mln`
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)} ming`
  return String(v)
}

function delta(cur: number, prev: number) {
  if (!prev) return null
  const d = (cur - prev) / Math.abs(prev)
  return `${d >= 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(0)}% o'tgan oyga nisbatan`
}

/** Horizontal ranked bars — one hue, values as text, no legend needed (single series). */
function BarList({ items, color, empty }: { items: { label: string; value: number }[]; color: string; empty: string }) {
  const max = Math.max(...items.map(i => Math.abs(i.value)), 1)
  const total = items.reduce((s, i) => s + i.value, 0)
  if (!items.length) return <p className="px-4 py-6 text-sm text-slate-400">{empty}</p>
  return (
    <ul className="space-y-2 px-4 py-3">
      {items.map(i => (
        <li key={i.label} className="group" title={`${i.label}: ${money(i.value)} so'm`}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="truncate text-slate-700">{i.label}</span>
            <span className="shrink-0 tabular-nums text-slate-900">{money(i.value)} <span className="text-xs text-slate-400">{total ? `${((i.value / total) * 100).toFixed(0)}%` : ''}</span></span>
          </div>
          <div className="mt-1 h-2 rounded bg-slate-100">
            <div className="h-2 rounded group-hover:opacity-80" style={{ width: `${(Math.abs(i.value) / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-semibold text-slate-700">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="ml-auto tabular-nums text-slate-900">{money(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage({ variant }: { variant: 'pnl' | 'cashflow' }) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [account, setAccount] = useState<number | null>(null)
  const [detail, setDetail] = useState<'category' | 'subcategory'>('category')
  const [showZero, setShowZero] = useState(false)
  const [series, setSeries] = useState({ income: true, expense: true, profit: true })
  const [focus, setFocus] = useState('')

  const kassa = useData<KassaReport>('/api/reports/kassa')
  const report = useData<PnlReport | CashflowReport>(variant === 'pnl'
    ? `/api/reports/pnl-monthly${query({ year })}`
    : `/api/reports/cashflow-monthly${query({ year, account_id: account })}`)
  const projects = useData<Project[]>(variant === 'pnl' ? '/api/projects' : null)

  const data = report.data
  const income = data ? data.summary.income : []
  const expense = data ? data.summary.expense : []
  const profit = income.map((v, i) => v - expense[i])

  const monthly = MONTHS.map((m, i) => ({ name: m.slice(0, 3), full: m, ДОХОД: income[i] ?? 0, РАСХОД: expense[i] ?? 0, ПРИБЫЛЬ: profit[i] ?? 0 }))

  const breakdown = (type: string) => {
    if (!data) return []
    return (data.rows as TreeRow[])
      .filter(r => r.type === type && (detail === 'category' ? r.level === 1 : r.level === 2 || !data.rows.some(x => x.level === 2 && x.category === r.category && x.type === type)))
      .map(r => ({ label: detail === 'subcategory' && r.level === 2 ? `${r.category} · ${r.label}` : r.label, value: r.values[month] }))
      .filter(i => showZero || Math.abs(i.value) > 0.004)
      .sort((a, b) => b.value - a.value)
  }

  const focusOptions = useMemo(() => (data ? (data.rows as TreeRow[]).filter(r => r.type !== 'ПЕРЕВОД') : []), [data])
  const focused = focusOptions.find(r => r.key === focus) ?? focusOptions.find(r => r.total !== 0) ?? null
  const focusSeries = focused ? MONTHS.map((m, i) => ({ name: m.slice(0, 3), full: m, Summa: focused.values[i] })) : []
  const debt = projects.data?.reduce((s, p) => s + Math.max(p.debt, 0), 0) ?? 0
  const prev = month > 0 ? month - 1 : null

  const isPnl = variant === 'pnl'
  return (
    <div className="space-y-4">
      <PageHeader title={isPnl ? 'Dashboard P&L' : 'Dashboard Cash flow'}
        subtitle={isPnl ? 'Foyda va zarar (ОПУ) ko\'rsatkichlari — P&L oyi bo\'yicha.' : 'Pul oqimi (ДДС) ko\'rsatkichlari — operatsiya sanasi bo\'yicha.'}>
        <YearSelect value={year} onChange={setYear} />
        <Select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-36">
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </Select>
        {!isPnl && <AccountSelect value={account} onChange={setAccount} />}
      </PageHeader>
      <ErrorBox message={report.error ?? kassa.error} />

      {/* БАЛАНС ДЕНЕЖНЫХ СРЕДСТВ */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="ТЕКУЩИЙ ОСТАТОК ДЕНЕЖНЫХ СРЕДСТВ">
          {!kassa.data ? <Spinner /> : (
            <div className="px-4 py-4">
              <div className={`text-3xl font-semibold tabular-nums ${kassa.data.total.balance < 0 ? 'text-rose-600' : 'text-slate-900'}`}>{money(kassa.data.total.balance)} <span className="text-base font-normal text-slate-500">so'm</span></div>
              <div className="mt-1 text-sm text-slate-500">
                {kassa.data.total.balance_usd !== null && <>≈ $ {decimal(kassa.data.total.balance_usd)} · </>}Bugun {dmy(kassa.data.today)}
              </div>
              {isPnl && projects.data && (
                <div className="mt-4 border-t border-slate-100 pt-3 text-sm">
                  <span className="text-slate-500">O'quvchilar qarzi (ДОЛГ): </span>
                  <Link to="/pnl" className="font-semibold text-rose-600 hover:underline">{money(debt)} so'm</Link>
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title="РАСПРЕДЕЛЕНИЕ ДЕНЕЖНЫХ СРЕДСТВ (hisoblar bo'yicha)" className="lg:col-span-2">
          {!kassa.data ? <Spinner /> : (
            <ul className="space-y-2 px-4 py-3">
              {kassa.data.rows.map(r => {
                const max = Math.max(...kassa.data!.rows.map(x => Math.abs(x.balance)), 1)
                return (
                  <li key={r.account_id} title={`${r.account}: ${money(r.balance)} so'm`}>
                    <div className="flex justify-between text-sm"><span>{r.account}</span><Money value={r.balance} className="font-medium" /></div>
                    <div className="mt-1 h-2 rounded bg-slate-100">
                      <div className="h-2 rounded" style={{ width: `${(Math.abs(r.balance) / max) * 100}%`, background: r.balance < 0 ? '#e34948' : C_INCOME }} />
                    </div>
                  </li>
                )
              })}
              <li className="pt-1 text-xs text-slate-400">Qizil — manfiy qoldiq.</li>
            </ul>
          )}
        </Card>
      </div>

      {!data ? <Spinner /> : (
        <>
          {/* ОБЩИЕ ПОКАЗАТЕЛИ */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Stat label={`ДОХОДЫ · ${MONTHS[month]} ${year}`} value={money(income[month])} tone="green" hint={prev !== null ? delta(income[month], income[prev]) : undefined} />
            <Stat label={`РАСХОДЫ · ${MONTHS[month]} ${year}`} value={money(expense[month])} tone="red" hint={prev !== null ? delta(expense[month], expense[prev]) : undefined} />
            <Stat label={`${isPnl ? 'ПРИБЫЛЬ' : 'ПРИБЫЛЬ (по кассе)'} · ${MONTHS[month]}`} value={<Money value={profit[month]} />} tone="blue"
              hint={`Yil bo'yicha: ${money(profit.reduce((a, b) => a + b, 0))}`} />
          </div>

          {/* РАСПРЕДЕЛЕНИЕ ПО КАТЕГОРИЯМ */}
          <Card title={`РАСПРЕДЕЛЕНИЕ ПО КАТЕГОРИЯМ — ${MONTHS[month]} ${year}`} actions={
            <div className="flex items-center gap-4">
              <Select value={detail} onChange={e => setDetail(e.target.value as 'category' | 'subcategory')} className="w-40">
                <option value="category">категории</option>
                <option value="subcategory">подкатегории</option>
              </Select>
              <Toggle checked={showZero} onChange={setShowZero} label="nol kategoriyalar" />
            </div>
          }>
            <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              <div><div className="px-4 pt-3 text-xs font-semibold text-slate-500">— ДОХОДЫ —</div><BarList items={breakdown('ДОХОД')} color={C_INCOME} empty="Bu oyda daromad yo'q" /></div>
              <div><div className="px-4 pt-3 text-xs font-semibold text-slate-500">— РАСХОДЫ —</div><BarList items={breakdown('РАСХОД')} color={C_EXPENSE} empty="Bu oyda xarajat yo'q" /></div>
            </div>
          </Card>

          {/* РАСПРЕДЕЛЕНИЕ ПО МЕСЯЦАМ */}
          <Card title={`РАСПРЕДЕЛЕНИЕ ПО МЕСЯЦАМ — ${year}`} actions={
            <div className="flex gap-4">
              <Toggle checked={series.income} onChange={v => setSeries(s => ({ ...s, income: v }))} label="ДОХОД" />
              <Toggle checked={series.expense} onChange={v => setSeries(s => ({ ...s, expense: v }))} label="РАСХОД" />
              <Toggle checked={series.profit} onChange={v => setSeries(s => ({ ...s, profit: v }))} label="ПРИБЫЛЬ" />
            </div>
          }>
            <div className="h-80 px-2 py-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthly} barGap={2} margin={{ left: 10, right: 10 }}>
                  <CartesianGrid vertical={false} stroke="#eef2f6" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {series.income && <Bar dataKey="ДОХОД" fill={C_INCOME} radius={[4, 4, 0, 0]} maxBarSize={22} />}
                  {series.expense && <Bar dataKey="РАСХОД" fill={C_EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={22} />}
                  {series.profit && <Line dataKey="ПРИБЫЛЬ" stroke={C_PROFIT} strokeWidth={2} dot={{ r: 4, fill: C_PROFIT, stroke: '#fff', strokeWidth: 2 }} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* ПОКАЗАТЕЛИ ПО КАТЕГОРИИ */}
          <Card title="ПОКАЗАТЕЛИ ПО КАТЕГОРИИ" actions={
            <Field label=""><Select value={focused?.key ?? ''} onChange={e => setFocus(e.target.value)} className="w-80">
              {focusOptions.map(r => <option key={r.key} value={r.key}>{r.level === 2 ? `   ${r.type}. ${r.category}. ${r.label}` : `${r.type}. ${r.category}`}</option>)}
            </Select></Field>
          }>
            {focused && (
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-4">
                <div className="space-y-3">
                  <Stat label={`Jami ${year}`} value={money(focused.total)} />
                  <Stat label="O'rtacha oyiga" value={money(focused.total / Math.max(1, focused.values.filter(v => v).length))} hint="faqat summasi bor oylar" />
                  <Stat label={`${MONTHS[month]}`} value={money(focused.values[month])} />
                </div>
                <div className="h-64 lg:col-span-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={focusSeries} margin={{ left: 10 }}>
                      <CartesianGrid vertical={false} stroke="#eef2f6" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={compact} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={70} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                      <Bar dataKey="Summa" fill={focused.type === 'ДОХОД' ? C_INCOME : C_EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}
