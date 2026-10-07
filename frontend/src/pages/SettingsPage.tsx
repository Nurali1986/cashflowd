import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp, Check, FolderPlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type Article } from '../api'
import { money } from '../format'
import { useData, useMeta } from '../meta'
import { Button, Card, ErrorBox, Field, IconButton, Input, PageHeader, Select } from '../ui'

type Kind = 'ДОХОД' | 'РАСХОД'

interface Group { category: string; items: Article[] }

function groupByCategory(list: Article[]): Group[] {
  const groups: Group[] = []
  for (const a of list) {
    const g = groups.find(x => x.category === a.category)
    if (g) g.items.push(a)
    else groups.push({ category: a.category, items: [a] })
  }
  return groups
}

/** One editor replaces both workbook blocks: J:L (dropdown) and N:Q (report rows). */
function ArticleTree({ type, all, onError, onChanged }: { type: Kind; all: Article[]; onError: (m: string) => void; onChanged: () => void }) {
  const groups = groupByCategory(all.filter(a => a.type === type))
  const categories = groups.map(g => g.category)
  const [adding, setAdding] = useState<string | null>(null)      // category name, or '' for a new category
  const [newCategory, setNewCategory] = useState('')
  const [newSub, setNewSub] = useState('')
  const [editing, setEditing] = useState<{ id: number; category: string; subcategory: string } | null>(null)
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)

  async function run(action: () => Promise<unknown>) {
    try { await action(); onChanged() } catch (e) { onError((e as Error).message) }
  }

  function saveNew() {
    const category = adding === '' ? newCategory.trim() : adding!
    if (!category) return onError('Kategoriya nomini kiriting')
    void run(async () => {
      await api.post('/api/articles', { type, category, subcategory: newSub.trim() || null })
      setAdding(null); setNewCategory(''); setNewSub('')
    })
  }

  function saveEdit() {
    if (!editing) return
    const a = all.find(x => x.id === editing.id)!
    void run(async () => {
      await api.put(`/api/articles/${a.id}`, { type, category: editing.category.trim(), subcategory: editing.subcategory.trim() || null, sort: a.sort })
      setEditing(null)
    })
  }

  function saveRename() {
    if (!renaming || !renaming.to.trim()) return
    const items = groups.find(g => g.category === renaming.from)?.items ?? []
    void run(async () => {
      for (const a of items) await api.put(`/api/articles/${a.id}`, { type, category: renaming.to.trim(), subcategory: a.subcategory, sort: a.sort })
      setRenaming(null)
    })
  }

  /** Reorder: whole list of ids (all types) with one article or one category block moved. */
  function move(ids: number[], dir: -1 | 1, isCategory: boolean, category: string) {
    const order = all.map(a => a.id)
    if (isCategory) {
      const idx = groups.findIndex(g => g.category === category)
      const other = groups[idx + dir]
      if (!other) return
      const block = groups[idx].items.map(a => a.id)
      const otherBlock = other.items.map(a => a.id)
      const without = order.filter(id => !block.includes(id))
      const anchor = without.indexOf(dir < 0 ? otherBlock[0] : otherBlock[otherBlock.length - 1])
      without.splice(dir < 0 ? anchor : anchor + 1, 0, ...block)
      void run(() => api.post('/api/articles/reorder', without))
    } else {
      const items = groups.find(g => g.category === category)!.items
      const i = items.findIndex(a => a.id === ids[0])
      const j = i + dir
      if (j < 0 || j >= items.length) return
      const a = order.indexOf(items[i].id), b = order.indexOf(items[j].id)
      ;[order[a], order[b]] = [order[b], order[a]]
      void run(() => api.post('/api/articles/reorder', order))
    }
  }

  const removeArticle = (a: Article) => {
    if (!confirm(`«${a.full_name}» o'chirilsinmi?`)) return
    void run(() => api.del(`/api/articles/${a.id}`))
  }

  const addForm = (category: string) => (
    <div className="flex flex-wrap items-end gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2">
      {category === '' && (
        <Field label="Yangi kategoriya" className="min-w-44 flex-1"><Input autoFocus value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="masalan: Transport" /></Field>
      )}
      <Field label={category === '' ? 'Birinchi modda (ixtiyoriy)' : `«${category}» ga yangi modda`} className="min-w-44 flex-1">
        <Input autoFocus={category !== ''} value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveNew()}
          placeholder={type === 'ДОХОД' ? 'masalan: 0-sinf a (uzbek)' : 'masalan: Aliyeva Nodira (matematika)'} />
      </Field>
      <Button variant="primary" onClick={saveNew}><Check className="h-4 w-4" />Qo'shish</Button>
      <Button onClick={() => { setAdding(null); setNewSub(''); setNewCategory('') }}>Bekor</Button>
    </div>
  )

  return (
    <Card title={type === 'ДОХОД' ? 'ДОХОД — daromad kategoriyalari va moddalari' : 'РАСХОД — xarajat kategoriyalari va moddalari'}
      actions={<Button onClick={() => { setAdding(''); setNewSub('') }}><FolderPlus className="h-4 w-4" />Yangi kategoriya</Button>}>
      {adding === '' && addForm('')}
      <div className="max-h-[640px] overflow-auto">
        <table className="sheet w-full">
          <tbody>
            {groups.map((g, gi) => {
              const usage = g.items.reduce((s, a) => s + (a.usage ?? 0), 0)
              return [
                <tr key={`c-${g.category}`} className="cat">
                  <td colSpan={2}>
                    {renaming?.from === g.category ? (
                      <div className="flex items-center gap-1">
                        <Input autoFocus value={renaming.to} onChange={e => setRenaming({ ...renaming, to: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setRenaming(null) }} className="w-64" />
                        <IconButton title="Saqlash" className="text-emerald-600" onClick={saveRename}><Check className="h-4 w-4" /></IconButton>
                        <IconButton title="Bekor" onClick={() => setRenaming(null)}><X className="h-4 w-4" /></IconButton>
                      </div>
                    ) : <>{g.category} <span className="ml-1 text-xs font-normal text-slate-400">{g.items.length} ta · {usage} operatsiya</span></>}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <IconButton title="Modda qo'shish" onClick={() => { setAdding(g.category); setNewSub('') }}><Plus className="h-4 w-4" /></IconButton>
                    <IconButton title="Kategoriya nomini o'zgartirish" onClick={() => setRenaming({ from: g.category, to: g.category })}><Pencil className="h-3.5 w-3.5" /></IconButton>
                    <IconButton title="Yuqoriga" disabled={gi === 0} onClick={() => move([], -1, true, g.category)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                    <IconButton title="Pastga" disabled={gi === groups.length - 1} onClick={() => move([], 1, true, g.category)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                  </td>
                </tr>,
                adding === g.category && <tr key={`add-${g.category}`}><td colSpan={3} className="p-0">{addForm(g.category)}</td></tr>,
                ...g.items.map((a, ai) => editing?.id === a.id ? (
                  <tr key={a.id} className="editing">
                    <td colSpan={2}>
                      <div className="flex flex-wrap items-center gap-2 pl-4">
                        <Select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })} className="w-48" title="Boshqa kategoriyaga ko'chirish">
                          {categories.map(c => <option key={c} value={c}>{c}</option>)}
                        </Select>
                        <Input autoFocus value={editing.subcategory} onChange={e => setEditing({ ...editing, subcategory: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(null) }} className="min-w-56 flex-1" />
                      </div>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <IconButton title="Saqlash" className="text-emerald-600" onClick={saveEdit}><Check className="h-4 w-4" /></IconButton>
                      <IconButton title="Bekor" onClick={() => setEditing(null)}><X className="h-4 w-4" /></IconButton>
                    </td>
                  </tr>
                ) : (
                  <tr key={a.id}>
                    <td className="pl-8">{a.subcategory ?? <span className="text-slate-400">(moddasiz — kategoriyaning o'zi)</span>}</td>
                    <td className="num text-xs text-slate-400">{a.usage ? `${a.usage} op.` : ''}</td>
                    <td className="whitespace-nowrap text-right">
                      <IconButton title="Nomini o'zgartirish / boshqa kategoriyaga ko'chirish" onClick={() => setEditing({ id: a.id, category: a.category, subcategory: a.subcategory ?? '' })}><Pencil className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title="Yuqoriga" disabled={ai === 0} onClick={() => move([a.id], -1, false, g.category)}><ArrowUp className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title="Pastga" disabled={ai === g.items.length - 1} onClick={() => move([a.id], 1, false, g.category)}><ArrowDown className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title={a.usage ? "Ishlatilgan moddani o'chirib bo'lmaydi" : "O'chirish"} disabled={!!a.usage} className="hover:text-rose-600" onClick={() => removeArticle(a)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </td>
                  </tr>
                )),
              ]
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Statuses({ onError }: { onError: (m: string) => void }) {
  const { meta, touch } = useMeta()
  const [name, setName] = useState('')
  async function save(list: string[]) {
    try { await api.put('/api/settings', { project_statuses: list.join('\n') }); touch() } catch (e) { onError((e as Error).message) }
  }
  return (
    <Card title="Loyiha statuslari (P&L → СТАТУС)">
      <ul className="divide-y divide-slate-100 text-sm">
        {meta.statuses.map(s => {
          const fixed = meta.inactive_statuses.includes(s)
          return (
            <li key={s} className="flex items-center justify-between px-4 py-1.5">
              <span>{s}{fixed && <span className="ml-2 text-xs text-slate-400">«Kim uchun» ro'yxatidan chiqaradi</span>}</span>
              {!fixed && <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => save(meta.statuses.filter(x => x !== s))}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
            </li>
          )
        })}
      </ul>
      <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={e => { e.preventDefault(); if (name.trim()) { void save([...meta.statuses, name.trim()]); setName('') } }}>
        <Input value={name} onChange={e => setName(e.target.value)} placeholder="Yangi status" />
        <Button type="submit"><Plus className="h-4 w-4" /></Button>
      </form>
    </Card>
  )
}

const GUIDE: [string, string][] = [
  ['4.1 Yangi sinf', "ДОХОД → «Kurs to'lovi» qatoridagi + → sinf nomi. Keyin справочник → ЗАКАЗЧИК ga ham qo'shing (P&L dagi sinf ro'yxati uchun)."],
  ['4.2 Yangi xodim', "РАСХОД → «Xodimlar maoshi» qatoridagi + → xodim ismi."],
  ['4.3 Yangi xarajat kategoriyasi', "РАСХОД → «Yangi kategoriya» → masalan Transport + Benzin."],
  ['4.4 Yangi hisob (Payme)', "справочник → СЧЕТ → «Hisob». Kassa va hisobotlarda avtomatik chiqadi (3 ta limit yo'q)."],
  ['4.5 Yangi oy', "Kerak emas — oy tanlagichda istalgan oy bor."],
  ["Nomni o'zgartirish", "✎ bilan o'zgartiring — eski operatsiyalar ham avtomatik yangi nomga o'tadi."],
  ["Boshqa kategoriyaga ko'chirish", "Moddadagi ✎ → kategoriyani tanlang (masalan Zuxra → Xodimlar maoshi). Eski summalar ham ko'chadi."],
]

export default function SettingsPage() {
  const { meta, touch } = useMeta()
  const { data: articles, refresh } = useData<Article[]>('/api/articles')
  const [error, setError] = useState<string | null>(null)
  const active = meta.projects.filter(p => p.active)

  return (
    <div className="space-y-4">
      <PageHeader title="настройки" subtitle="Статьялар (kategoriya va moddalar) va statuslar shu yerda o'zgartiriladi. Excel'dagi J:L va N:Q bloklari bitta ro'yxatga birlashgan — bir joyga qo'shsangiz, ham Cash flow tanlov ro'yxatida, ham barcha hisobotlarda darhol chiqadi." />
      <ErrorBox message={error} onClose={() => setError(null)} />

      <Card title="Qo'llanma → web versiyada qanday qilinadi">
        <table className="sheet w-full">
          <tbody>{GUIDE.map(([k, v]) => <tr key={k}><td className="w-56 font-medium">{k}</td><td className="text-slate-600">{v}</td></tr>)}</tbody>
        </table>
      </Card>

      {articles && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ArticleTree type="ДОХОД" all={articles} onError={setError} onChanged={() => { refresh(); touch() }} />
          <ArticleTree type="РАСХОД" all={articles} onError={setError} onChanged={() => { refresh(); touch() }} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Statuses onError={setError} />
        <Card title="Hisoblar va boshlang'ich qoldiq" actions={<Link to="/spravochnik" className="text-xs text-sky-600 hover:underline">справочникda o'zgartirish →</Link>}>
          <table className="sheet w-full"><tbody>
            <tr className="sum"><td>ВСЕ СЧЕТА</td><td className="num">{money(meta.accounts.reduce((s, a) => s + a.opening_balance, 0))}</td></tr>
            {meta.accounts.map(a => <tr key={a.id}><td>{a.name}</td><td className="num">{money(a.opening_balance)}</td></tr>)}
          </tbody></table>
        </Card>
        <Card title={`Faol loyihalar — «Kim uchun» ro'yxati (${active.length})`}>
          <ul className="max-h-72 divide-y divide-slate-100 overflow-auto text-sm">
            {active.map(p => <li key={p.id} className="flex justify-between px-4 py-1.5"><Link className="hover:underline" to={`/otchet/${p.id}`}>{p.name}</Link><span className="text-slate-400">{p.customer}</span></li>)}
          </ul>
        </Card>
      </div>
    </div>
  )
}
