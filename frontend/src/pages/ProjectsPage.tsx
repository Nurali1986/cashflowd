import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, BookOpen, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type Project, type ProjectInput } from '../api'
import { dmy, money, percent } from '../format'
import { useData, useMeta } from '../meta'
import { Button, Card, Empty, ErrorBox, Field, IconButton, Input, Money, NumberInput, PageHeader, Select, Spinner, Stat, Toggle } from '../ui'

const blank: ProjectInput = {
  order_date: null, name: '', customer: null, description: null, category: null,
  contract_amount: null, status: null, close_date: null, comment: null,
}

function EditRow({ value, onChange, onSave, onCancel, saving }: {
  value: ProjectInput; onChange: (v: ProjectInput) => void; onSave: () => void; onCancel: () => void; saving: boolean
}) {
  const { meta } = useMeta()
  const set = <K extends keyof ProjectInput>(k: K, v: ProjectInput[K]) => onChange({ ...value, [k]: v })
  const customers = meta.directory.filter(d => d.kind === 'customer')
  const categories = meta.directory.filter(d => d.kind === 'order_category')
  return (
    <tr className="editing" onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel() }}>
      <td><Input type="date" value={value.order_date ?? ''} onChange={e => set('order_date', e.target.value || null)} className="w-36" /></td>
      <td><Input autoFocus value={value.name} onChange={e => set('name', e.target.value)} placeholder="F.I.Sh / proyekt" className="w-52" /></td>
      <td>
        <Input list="customer-options" value={value.customer ?? ''} onChange={e => set('customer', e.target.value || null)} className="w-36" />
        <datalist id="customer-options">{customers.map(c => <option key={c.id} value={c.name} />)}</datalist>
      </td>
      <td><Input value={value.description ?? ''} onChange={e => set('description', e.target.value || null)} className="w-36" /></td>
      <td>
        <Input list="order-category-options" value={value.category ?? ''} onChange={e => set('category', e.target.value || null)} className="w-32" />
        <datalist id="order-category-options">{categories.map(c => <option key={c.id} value={c.name} />)}</datalist>
      </td>
      <td><NumberInput value={value.contract_amount} onChange={v => set('contract_amount', v)} className="w-32" /></td>
      <td>
        <Select value={value.status ?? ''} onChange={e => set('status', e.target.value || null)} className="w-32">
          <option value="">—</option>
          {meta.statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
      </td>
      <td><Input type="date" value={value.close_date ?? ''} onChange={e => set('close_date', e.target.value || null)} className="w-36" /></td>
      <td colSpan={5} className="text-xs text-slate-400">Oplachено / Долг / Расходы / Маржа avtomatik hisoblanadi</td>
      <td><Input value={value.comment ?? ''} onChange={e => set('comment', e.target.value || null)} className="w-40" /></td>
      <td className="whitespace-nowrap">
        <IconButton title="Saqlash (Enter)" onClick={onSave} disabled={saving} className="text-emerald-600"><Check className="h-4 w-4" /></IconButton>
        <IconButton title="Bekor qilish (Esc)" onClick={onCancel}><X className="h-4 w-4" /></IconButton>
      </td>
    </tr>
  )
}

export default function ProjectsPage() {
  const { touch, meta } = useMeta()
  const { data, error: loadError, loading } = useData<Project[]>('/api/projects')
  const [editId, setEditId] = useState<number | 'new' | null>(null)
  const [draft, setDraft] = useState<ProjectInput>(blank)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [customer, setCustomer] = useState('')
  const [status, setStatus] = useState('')
  const [debtOnly, setDebtOnly] = useState(false)
  const [sort, setSort] = useState('order')

  const rows = useMemo(() => {
    let list = data ?? []
    const q = search.trim().toLowerCase()
    if (q) list = list.filter(p => [p.name, p.customer, p.description, p.comment].some(v => v?.toLowerCase().includes(q)))
    if (customer) list = list.filter(p => (p.customer ?? '') === customer)
    if (status) list = list.filter(p => (status === 'none' ? !p.status : p.status === status))
    if (debtOnly) list = list.filter(p => p.debt > 0)
    const sorted = [...list]
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'debt') sorted.sort((a, b) => b.debt - a.debt)
    if (sort === 'customer') sorted.sort((a, b) => (a.customer ?? '').localeCompare(b.customer ?? '', undefined, { numeric: true }) || a.name.localeCompare(b.name))
    return sorted
  }, [data, search, customer, status, debtOnly, sort])

  const totals = useMemo(() => rows.reduce((t, p) => ({
    contract: t.contract + (p.contract_amount ?? 0), paid: t.paid + p.paid, debt: t.debt + p.debt,
    expenses: t.expenses + p.expenses, margin: t.margin + p.margin,
  }), { contract: 0, paid: 0, debt: 0, expenses: 0, margin: 0 }), [rows])

  const customers = Array.from(new Set((data ?? []).map(p => p.customer).filter(Boolean) as string[]))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  function startEdit(p: Project | null) {
    setError(null)
    if (p) {
      setDraft({
        order_date: p.order_date, name: p.name, customer: p.customer, description: p.description, category: p.category,
        contract_amount: p.contract_amount, status: p.status, close_date: p.close_date, comment: p.comment,
      })
      setEditId(p.id)
    } else {
      setDraft({ ...blank, category: meta.directory.find(d => d.kind === 'order_category')?.name ?? null })
      setEditId('new')
    }
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      if (editId === 'new') await api.post('/api/projects', draft)
      else await api.put(`/api/projects/${editId}`, draft)
      setEditId(null)
      touch()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(p: Project) {
    if (!confirm(`«${p.name}» o'chirilsinmi?`)) return
    try {
      await api.del(`/api/projects/${p.id}`)
      touch()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="P&L" subtitle="Loyihalar (o'quvchilar) ro'yxati: shartnoma summasi, to'langan, qarz, xarajat va marja. To'lovlar Cash flow'dan avtomatik yig'iladi.">
        <Button variant="primary" onClick={() => startEdit(null)} disabled={editId === 'new'}><Plus className="h-4 w-4" />Yangi loyiha</Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="СТОИМОСТЬ (shartnoma)" value={money(totals.contract)} />
        <Stat label="ОПЛАЧЕНО ФАКТ" value={money(totals.paid)} tone="green" />
        <Stat label="Долг" value={money(totals.debt)} tone={totals.debt > 0 ? 'red' : 'slate'} />
        <Stat label="Расходы" value={money(totals.expenses)} />
        <Stat label="Маржа" value={money(totals.margin)} tone="blue" />
      </div>

      <Card>
        <div className="grid grid-cols-2 gap-3 p-3 md:grid-cols-6">
          <Field label="Qidiruv" className="col-span-2"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ism, sinf, izoh…" /></Field>
          <Field label="sinf (ЗАКАЗЧИК)">
            <Select value={customer} onChange={e => setCustomer(e.target.value)}>
              <option value="">Hammasi</option>
              {customers.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="СТАТУС">
            <Select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Hammasi</option>
              <option value="none">Ko'rsatilmagan</option>
              {meta.statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </Select>
          </Field>
          <Field label="Tartib">
            <Select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="order">Kiritilgan tartib</option>
              <option value="name">Ism bo'yicha</option>
              <option value="customer">Sinf bo'yicha</option>
              <option value="debt">Qarz (kattadan)</option>
            </Select>
          </Field>
          <div className="flex items-end pb-1.5"><Toggle checked={debtOnly} onChange={setDebtOnly} label="Faqat qarzdorlar" /></div>
        </div>
      </Card>

      <ErrorBox message={error ?? loadError} onClose={() => setError(null)} />

      <Card>
        {!data && loading ? <Spinner /> : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="sheet w-full min-w-[1500px]">
              <thead>
                <tr>
                  <th>ДАТА ЗАКАЗА</th>
                  <th className="sticky-col">Nima uchun (Proyekt)</th>
                  <th>sinf (ЗАКАЗЧИК)</th>
                  <th>ОПИСАНИЕ</th>
                  <th>КАТЕГОРИЯ</th>
                  <th className="num">СТОИМОСТЬ</th>
                  <th>СТАТУС</th>
                  <th>ДАТА ЗАКРЫТИЯ</th>
                  <th className="num">ОПЛАЧЕНО ФАКТ</th>
                  <th className="num">ДОЛГ</th>
                  <th className="num">РАСХОДЫ</th>
                  <th className="num">МАРЖА</th>
                  <th className="num">РЕНТАБ., %</th>
                  <th>КОММЕНТАРИЙ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr className="sum">
                  <td></td>
                  <td className="sticky-col">Jami ({rows.length})</td>
                  <td colSpan={3}></td>
                  <td className="num">{money(totals.contract)}</td>
                  <td colSpan={2}></td>
                  <td className="num">{money(totals.paid)}</td>
                  <td className="num"><Money value={totals.debt} /></td>
                  <td className="num">{money(totals.expenses)}</td>
                  <td className="num"><Money value={totals.margin} /></td>
                  <td colSpan={3}></td>
                </tr>
                {editId === 'new' && <EditRow value={draft} onChange={setDraft} onSave={save} onCancel={() => setEditId(null)} saving={saving} />}
                {rows.map(p => editId === p.id ? (
                  <EditRow key={p.id} value={draft} onChange={setDraft} onSave={save} onCancel={() => setEditId(null)} saving={saving} />
                ) : (
                  <tr key={p.id} onDoubleClick={() => startEdit(p)}>
                    <td className="whitespace-nowrap">{dmy(p.order_date)}</td>
                    <td className="sticky-col max-w-[240px] truncate font-medium" title={p.name}>{p.name}</td>
                    <td className="whitespace-nowrap">{p.customer}</td>
                    <td className="max-w-[160px] truncate" title={p.description ?? ''}>{p.description}</td>
                    <td className="whitespace-nowrap">{p.category}</td>
                    <td className="num">{money(p.contract_amount)}</td>
                    <td className="whitespace-nowrap">{p.status}</td>
                    <td className="whitespace-nowrap">{dmy(p.close_date)}</td>
                    <td className="num text-emerald-700">{money(p.paid)}</td>
                    <td className="num"><Money value={p.debt} className={p.debt > 0 ? 'font-medium text-rose-600' : ''} /></td>
                    <td className="num">{money(p.expenses)}</td>
                    <td className="num"><Money value={p.margin} /></td>
                    <td className="num">{percent(p.profitability)}</td>
                    <td className="max-w-[200px] truncate text-slate-600" title={p.comment ?? ''}>{p.comment}</td>
                    <td className="whitespace-nowrap text-right">
                      {(p.duplicate || p.close_error) && (
                        <span title={[p.duplicate && 'Nom takrorlangan', p.close_error && "Status va yopilish sanasi mos emas (выполнен/отменен ↔ ДАТА ЗАКРЫТИЯ)"].filter(Boolean).join('; ')}>
                          <AlertTriangle className="mr-1 inline h-4 w-4 text-amber-500" />
                        </span>
                      )}
                      <Link to={`/otchet/${p.id}`} title="ОТЧЕТ по проекту" className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"><BookOpen className="h-3.5 w-3.5" /></Link>
                      <IconButton title="Tahrirlash" onClick={() => startEdit(p)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && editId !== 'new' && <Empty>Loyihalar topilmadi</Empty>}
          </div>
        )}
      </Card>
    </div>
  )
}
