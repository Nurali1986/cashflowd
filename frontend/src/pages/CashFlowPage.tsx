import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import { api, query, type Transaction, type TransactionPage } from '../api'
import { money } from '../format'
import { useData, useMeta } from '../meta'
import TransactionForm from '../components/TransactionForm'
import TransactionTable from '../components/TransactionTable'
import { AccountSelect, Button, Card, Empty, ErrorBox, Field, Input, PageHeader, Select, Spinner, Toggle } from '../ui'

const PAGE = 100

export default function CashFlowPage({ isPlan }: { isPlan: boolean }) {
  const { meta, touch } = useMeta()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [copyFrom, setCopyFrom] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)

  const filters = {
    date_from: params.get('from') ?? '',
    date_to: params.get('to') ?? '',
    account_id: params.get('account') ? Number(params.get('account')) : null,
    kind: params.get('kind') ?? '',
    category: params.get('category') ?? '',
    project_id: params.get('project') ?? '',
    q: params.get('q') ?? '',
    article_id: params.get('article') ?? '',
    pnl_month: params.get('pnl') ?? '',
    cash: params.get('cash') ?? '',
    receipt: params.get('receipt') ?? '',
    warnings_only: params.get('warnings') === '1',
    page: Number(params.get('page') ?? 0),
  }
  const setFilter = (key: string, value: string | number | null | boolean) => {
    const next = new URLSearchParams(params)
    if (value === null || value === '' || value === false) next.delete(key)
    else next.set(key, value === true ? '1' : String(value))
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }

  const url = `/api/transactions${query({
    is_plan: isPlan, date_from: filters.date_from, date_to: filters.date_to, account_id: filters.account_id,
    kind: filters.kind, category: filters.category, article_id: filters.article_id, pnl_month: filters.pnl_month, project_id: filters.project_id, q: filters.q, cash: filters.cash, receipt: filters.receipt,
    warnings_only: filters.warnings_only, limit: PAGE, offset: filters.page * PAGE,
  })}`
  const { data, error: loadError, loading, refresh } = useData<TransactionPage>(url)

  const categories = Array.from(new Set(meta.articles.map(a => `${a.type}|${a.category}`)))
  const pages = data ? Math.ceil(data.total / PAGE) : 0

  async function remove(t: Transaction) {
    if (!confirm(`O'chirilsinmi?\n${t.date ?? 'sanasiz'} · ${t.article_name ?? ''} · ${money(t.amount)} so'm`)) return
    try {
      await api.del(`/api/transactions/${t.id}`)
      if (editing?.id === t.id) setEditing(null)
      touch()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={isPlan ? 'P&L Reja' : 'Cash flow'}
        subtitle={isPlan
          ? "Rejalashtirilgan daromad va xarajatlar — «P&L oylik» sahifasidagi «План» ustunlariga tushadi."
          : "Barcha pul operatsiyalari. Sanasi bor qatorlar kassaga (ДДС) va P&L ga, sanasiz qatorlar faqat P&L (ОПУ) ga kiradi."}
      />

      <TransactionForm
        isPlan={isPlan}
        editing={editing}
        copyFrom={copyFrom}
        onSaved={() => { setEditing(null); setCopyFrom(null); touch() }}
        onCancel={() => { setEditing(null); setCopyFrom(null) }}
      />

      <Card>
        <div className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3 md:grid-cols-5 xl:grid-cols-10">
          <Field label="Sanadan"><Input type="date" value={filters.date_from} onChange={e => setFilter('from', e.target.value)} /></Field>
          <Field label="Sanagacha"><Input type="date" value={filters.date_to} onChange={e => setFilter('to', e.target.value)} /></Field>
          <Field label="СЧЕТ"><AccountSelect value={filters.account_id} onChange={v => setFilter('account', v)} allLabel="Barcha hisoblar" /></Field>
          <Field label="Turi">
            <Select value={filters.kind} onChange={e => setFilter('kind', e.target.value)}>
              <option value="">Hammasi</option>
              <option value="ДОХОД">ДОХОД</option>
              <option value="РАСХОД">РАСХОД</option>
              <option value="ПЕРЕВОД">ПЕРЕВОД</option>
              <option value="none">Статья ko'rsatilmagan</option>
            </Select>
          </Field>
          <Field label="КАТЕГОРИЯ">
            <Select value={filters.category} onChange={e => setFilter('category', e.target.value)}>
              <option value="">Hammasi</option>
              {categories.map(c => { const [type, name] = c.split('|'); return <option key={c} value={name}>{type === 'ДОХОД' ? '＋ ' : '－ '}{name}</option> })}
            </Select>
          </Field>
          <Field label="Proyekt">
            <Select value={filters.project_id} onChange={e => setFilter('project', e.target.value)}>
              <option value="">Hammasi</option>
              {meta.projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Sana bo'yicha">
            <Select value={filters.cash} onChange={e => setFilter('cash', e.target.value)}>
              <option value="">Hammasi</option>
              <option value="cash">Sanali (ДДС)</option>
              <option value="accrual">Sanasiz (faqat P&L)</option>
            </Select>
          </Field>
          <Field label="Chek">
            <Select value={filters.receipt} onChange={e => setFilter('receipt', e.target.value)}>
              <option value="">Hammasi</option>
              <option value="with">Chek bor</option>
              <option value="without">Chek yo'q</option>
              <option value="unverified">Tekshirilmagan</option>
              <option value="verified">Tekshirilgan ✓</option>
            </Select>
          </Field>
          <Field label="Qidiruv" className="col-span-2">
            <Input value={filters.q} placeholder="Izoh, o'quvchi, статья, summa…" onChange={e => setFilter('q', e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
          <div className="flex flex-wrap items-center gap-4">
            {filters.article_id && <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700">Статья: {meta.articles.find(a => String(a.id) === filters.article_id)?.full_name}</span>}
            {filters.pnl_month && <span className="rounded bg-sky-50 px-2 py-0.5 text-xs text-sky-700">P&L oyi: {filters.pnl_month}</span>}
            <Toggle checked={filters.warnings_only} onChange={v => setFilter('warnings', v)} label="Faqat tekshirish kerak bo'lganlar ⚠" />
            <Button variant="ghost" onClick={() => setParams(new URLSearchParams(), { replace: true })}><RotateCcw className="h-3.5 w-3.5" />Filtrlarni tozalash</Button>
          </div>
          {data && (
            <div className="flex flex-wrap items-center gap-4 text-slate-600">
              <span>Qatorlar: <b>{data.total}</b></span>
              <span>ДОХОД: <b className="text-emerald-700">{money(data.sum_income)}</b></span>
              <span>РАСХОД: <b className="text-rose-700">{money(data.sum_expense)}</b></span>
              {data.sum_transfer > 0 && <span>ПЕРЕВОД: <b className="text-sky-700">{money(data.sum_transfer)}</b></span>}
            </div>
          )}
        </div>
      </Card>

      <ErrorBox message={error ?? loadError} onClose={() => setError(null)} />

      <Card>
        {!data && loading ? <Spinner /> : data && data.items.length === 0 ? <Empty>Operatsiyalar topilmadi</Empty> : data && (
          <>
            <TransactionTable
              rows={data.items}
              editingId={editing?.id}
              onEdit={t => { setCopyFrom(null); setEditing(t); window.scrollTo({ top: 0, behavior: 'smooth' }); document.querySelector('main > div')?.scrollTo({ top: 0, behavior: 'smooth' }) }}
              onCopy={t => { setEditing(null); setCopyFrom(t); document.querySelector('main > div')?.scrollTo({ top: 0, behavior: 'smooth' }) }}
              onDelete={remove}
            />
            {pages > 1 && (
              <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
                <Button disabled={filters.page === 0} onClick={() => setFilter('page', filters.page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <span>{filters.page + 1} / {pages}</span>
                <Button disabled={filters.page >= pages - 1} onClick={() => setFilter('page', filters.page + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            )}
          </>
        )}
      </Card>
      {loading && data && <div className="text-xs text-slate-400">Yangilanmoqda… <button className="underline" onClick={refresh}>qayta</button></div>}
    </div>
  )
}
