import { Fragment, useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type Account, type Article, type DirectoryItem } from '../api'
import { money } from '../format'
import { useData, useMeta } from '../meta'
import { Button, Card, ErrorBox, Field, IconButton, Input, NumberInput, PageHeader, Select } from '../ui'

function GeneralSettings({ onError }: { onError: (m: string) => void }) {
  const { meta, touch } = useMeta()
  const [start, setStart] = useState(meta.settings.start_date)
  const [closeFlag, setCloseFlag] = useState(meta.settings.pnl_use_close_date)
  const [company, setCompany] = useState(meta.settings.company_name)
  const [saved, setSaved] = useState(false)
  async function save() {
    try {
      await api.put('/api/settings', { start_date: start, pnl_use_close_date: closeFlag, company_name: company })
      setSaved(true)
      touch()
    } catch (e) { onError((e as Error).message) }
  }
  return (
    <Card title="Umumiy sozlamalar">
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
        <Field label="ДАТА НАЧАЛА (hisob boshlanishi)"><Input type="date" value={start} onChange={e => { setStart(e.target.value); setSaved(false) }} /></Field>
        <Field label="Учитывать в ОПУ дату закрытия проекта">
          <Select value={closeFlag} onChange={e => { setCloseFlag(e.target.value); setSaved(false) }}>
            <option value="0">НЕТ — P&L oyi bo'yicha</option>
            <option value="1">ДА — loyiha yopilgan oy bo'yicha</option>
          </Select>
        </Field>
        <Field label="Tashkilot nomi"><Input value={company} onChange={e => { setCompany(e.target.value); setSaved(false) }} /></Field>
        <div className="flex items-end gap-2"><Button variant="primary" onClick={save}>Saqlash</Button>{saved && <span className="text-sm text-emerald-600">Saqlandi</span>}</div>
      </div>
    </Card>
  )
}

function Accounts({ onError }: { onError: (m: string) => void }) {
  const { meta, touch } = useMeta()
  const [edit, setEdit] = useState<Partial<Account> | null>(null)
  async function save() {
    if (!edit?.name?.trim()) return onError('Hisob nomini kiriting')
    try {
      const body = { name: edit.name, opening_balance: edit.opening_balance ?? 0, sort: edit.sort ?? meta.accounts.length }
      if (edit.id) await api.put(`/api/accounts/${edit.id}`, body)
      else await api.post('/api/accounts', body)
      setEdit(null)
      touch()
    } catch (e) { onError((e as Error).message) }
  }
  async function remove(a: Account) {
    if (!confirm(`«${a.name}» hisobi o'chirilsinmi?`)) return
    try { await api.del(`/api/accounts/${a.id}`); touch() } catch (e) { onError((e as Error).message) }
  }
  const row = (
    <tr className="editing">
      <td><Input autoFocus value={edit?.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></td>
      <td><NumberInput value={edit?.opening_balance ?? 0} onChange={v => setEdit({ ...edit, opening_balance: v ?? 0 })} /></td>
      <td className="text-right whitespace-nowrap">
        <IconButton title="Saqlash" className="text-emerald-600" onClick={save}><Check className="h-4 w-4" /></IconButton>
        <IconButton title="Bekor qilish" onClick={() => setEdit(null)}><X className="h-4 w-4" /></IconButton>
      </td>
    </tr>
  )
  return (
    <Card title="СЧЕТ — hisoblar va boshlang'ich summa" actions={<Button onClick={() => setEdit({ name: '', opening_balance: 0 })}><Plus className="h-4 w-4" />Hisob</Button>}>
      <table className="sheet w-full">
        <thead><tr><th>СЧЕТ</th><th className="num">СУММА НА НАЧАЛО</th><th className="w-20"></th></tr></thead>
        <tbody>
          {edit && !edit.id && row}
          {meta.accounts.map(a => edit?.id === a.id ? <Fragment key={a.id}>{row}</Fragment> : (
            <tr key={a.id}>
              <td className="font-medium">{a.name}</td>
              <td className="num">{money(a.opening_balance)}</td>
              <td className="text-right whitespace-nowrap">
                <IconButton title="Tahrirlash" onClick={() => setEdit(a)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

function Articles({ type, onError }: { type: 'ДОХОД' | 'РАСХОД'; onError: (m: string) => void }) {
  const { touch } = useMeta()
  const { data } = useData<Article[]>('/api/articles')
  const [edit, setEdit] = useState<{ id?: number; category: string; subcategory: string } | null>(null)
  const list = (data ?? []).filter(a => a.type === type)
  const categories = Array.from(new Set(list.map(a => a.category)))

  async function save() {
    if (!edit?.category.trim()) return onError('Kategoriyani kiriting')
    try {
      const body = { type, category: edit.category, subcategory: edit.subcategory || null }
      if (edit.id) await api.put(`/api/articles/${edit.id}`, { ...body, sort: list.find(a => a.id === edit.id)?.sort })
      else await api.post('/api/articles', body)
      setEdit(null)
      touch()
    } catch (e) { onError((e as Error).message) }
  }
  async function remove(a: Article) {
    if (!confirm(`«${a.full_name}» o'chirilsinmi?`)) return
    try { await api.del(`/api/articles/${a.id}`); touch() } catch (e) { onError((e as Error).message) }
  }
  const listId = `cat-${type}`
  const form = edit && (
    <div className="flex flex-wrap items-end gap-2 border-b border-amber-200 bg-amber-50 p-3">
      <Field label="КАТЕГОРИЯ" className="min-w-48 flex-1">
        <Input list={listId} autoFocus value={edit.category} onChange={e => setEdit({ ...edit, category: e.target.value })} />
        <datalist id={listId}>{categories.map(c => <option key={c} value={c} />)}</datalist>
      </Field>
      <Field label="ПОДКАТЕГОРИЯ" className="min-w-48 flex-1"><Input value={edit.subcategory} onChange={e => setEdit({ ...edit, subcategory: e.target.value })} onKeyDown={e => e.key === 'Enter' && save()} /></Field>
      <Button variant="primary" onClick={save}><Check className="h-4 w-4" />Saqlash</Button>
      <Button onClick={() => setEdit(null)}>Bekor</Button>
      {edit.id && <p className="w-full text-xs text-amber-700">Nomni o'zgartirsangiz, barcha eski operatsiyalarda ham yangilanadi.</p>}
    </div>
  )
  return (
    <Card title={type === 'ДОХОД' ? 'КАТЕГОРИЯ ДОХОДЫ (daromad статьялари)' : 'КАТЕГОРИЯ РАСХОДЫ (xarajat статьялари)'}
      actions={<Button onClick={() => setEdit({ category: '', subcategory: '' })}><Plus className="h-4 w-4" />Статья</Button>}>
      {form}
      <div className="max-h-[480px] overflow-auto">
        <table className="sheet w-full">
          <thead><tr><th>КАТЕГОРИЯ</th><th>ПОДКАТЕГОРИЯ</th><th className="num">Operatsiyalar</th><th className="w-20"></th></tr></thead>
          <tbody>
            {list.map((a, i) => (
              <tr key={a.id}>
                <td className={i > 0 && list[i - 1].category === a.category ? 'text-slate-300' : 'font-medium'}>{a.category}</td>
                <td>{a.subcategory ?? <span className="text-slate-400">—</span>}</td>
                <td className="num text-slate-500">{a.usage || ''}</td>
                <td className="text-right whitespace-nowrap">
                  <IconButton title="Tahrirlash" onClick={() => setEdit({ id: a.id, category: a.category, subcategory: a.subcategory ?? '' })}><Pencil className="h-3.5 w-3.5" /></IconButton>
                  <IconButton title="O'chirish" className="hover:text-rose-600" disabled={!!a.usage} onClick={() => remove(a)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function SimpleList({ kind, title, onError }: { kind: DirectoryItem['kind']; title: string; onError: (m: string) => void }) {
  const { meta, touch } = useMeta()
  const items = meta.directory.filter(d => d.kind === kind)
  const [name, setName] = useState('')
  async function add() {
    if (!name.trim()) return
    try { await api.post('/api/directory', { kind, name, sort: items.length }); setName(''); touch() } catch (e) { onError((e as Error).message) }
  }
  async function remove(d: DirectoryItem) {
    try { await api.del(`/api/directory/${d.id}`); touch() } catch (e) { onError((e as Error).message) }
  }
  return (
    <Card title={title}>
      <form className="flex gap-2 border-b border-slate-100 p-3" onSubmit={e => { e.preventDefault(); void add() }}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Yangi qiymat" />
        <Button type="submit"><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="max-h-72 divide-y divide-slate-100 overflow-auto text-sm">
        {items.map(d => (
          <li key={d.id} className="flex items-center justify-between px-3 py-1.5">
            {d.name}
            <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => remove(d)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function DirectoryPage() {
  const [error, setError] = useState<string | null>(null)
  return (
    <div className="space-y-4">
      <PageHeader title="справочник" subtitle="Ma'lumotnomalar: hisoblar, daromad/xarajat статьялари, sinflar va buyurtma kategoriyalari. Bu yerdagi ro'yxatlar Cash flow va P&L'dagi tanlov ro'yxatlariga tushadi." />
      <ErrorBox message={error} onClose={() => setError(null)} />
      <GeneralSettings onError={setError} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Accounts onError={setError} />
        <SimpleList kind="customer" title="ЗАКАЗЧИК (sinflar)" onError={setError} />
        <SimpleList kind="order_category" title="КАТЕГОРИЯ ЗАКАЗА" onError={setError} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Articles type="ДОХОД" onError={setError} />
        <Articles type="РАСХОД" onError={setError} />
      </div>
    </div>
  )
}
