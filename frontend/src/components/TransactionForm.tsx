import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeftRight, Plus, Save, X } from 'lucide-react'
import { api, type Transaction, type TransactionInput } from '../api'
import { monthIso, todayIso } from '../format'
import { useMeta } from '../meta'
import { Button, ErrorBox, Field, Input, NumberInput, Select, Toggle } from '../ui'

interface Draft {
  transfer: boolean
  noDate: boolean
  date: string
  pnlMonth: string
  articleText: string
  accountId: number | null
  toAccountId: number | null
  usd: number | null
  rate: number | null
  amount: number | null
  amountTouched: boolean
  project: string
  comment: string
}

function emptyDraft(transfer = false, keep?: Draft): Draft {
  const today = todayIso()
  return {
    transfer,
    noDate: false,
    date: keep?.date ?? today,
    pnlMonth: keep?.pnlMonth ?? monthIso(today),
    articleText: '',
    accountId: keep?.accountId ?? null,
    toAccountId: null,
    usd: null,
    rate: null,
    amount: null,
    amountTouched: false,
    project: '',
    comment: '',
  }
}

function fromTransaction(t: Transaction): Draft {
  return {
    transfer: t.kind === 'ПЕРЕВОД',
    noDate: !t.date,
    date: t.date ?? '',
    pnlMonth: t.pnl_month ? monthIso(t.pnl_month) : '',
    articleText: t.kind === 'ПЕРЕВОД' ? '' : t.article_name ?? '',
    accountId: t.account_id,
    toAccountId: t.to_account_id,
    usd: t.usd,
    rate: t.usd_rate,
    amount: t.amount,
    amountTouched: true,
    project: t.project_name ?? '',
    comment: t.comment ?? '',
  }
}

export default function TransactionForm({ isPlan, editing, copyFrom, onSaved, onCancel, transferOnly = false }: {
  isPlan: boolean
  editing: Transaction | null
  copyFrom: Transaction | null
  onSaved: (t: Transaction, created: boolean) => void
  onCancel: () => void
  transferOnly?: boolean
}) {
  const { meta } = useMeta()
  const [draft, setDraft] = useState<Draft>(() => emptyDraft(transferOnly))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editing) setDraft(fromTransaction(editing))
  }, [editing])
  useEffect(() => {
    if (copyFrom) setDraft({ ...fromTransaction(copyFrom), date: copyFrom.date ? todayIso() : '', amountTouched: true })
  }, [copyFrom])

  const articleByName = useMemo(() => new Map(meta.articles.map(a => [a.full_name.toLowerCase(), a])), [meta.articles])
  const article = articleByName.get(draft.articleText.trim().toLowerCase()) ?? null
  const projectExists = !draft.project.trim() || meta.projects.some(p => p.name.toLowerCase() === draft.project.trim().toLowerCase())

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(d => ({ ...d, [key]: value }))

  // Курс доллар = rate from the Kurs sheet for the operation date (like the VLOOKUP in Cash flow!F).
  useEffect(() => {
    if (!draft.usd || draft.rate) return
    const on = draft.noDate ? `${draft.pnlMonth}-01` : draft.date
    if (!on || on.length < 10) return
    let cancelled = false
    api.get<{ rate: number | null }>(`/api/rates/lookup?on=${on}`).then(r => {
      if (!cancelled && r.rate) setDraft(d => (d.rate ? d : { ...d, rate: r.rate }))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [draft.usd, draft.date, draft.pnlMonth, draft.noDate, draft.rate])

  useEffect(() => {
    if (!draft.amountTouched && draft.usd && draft.rate) setDraft(d => ({ ...d, amount: Math.round((d.usd ?? 0) * (d.rate ?? 0) * 100) / 100 }))
  }, [draft.usd, draft.rate, draft.amountTouched])

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    setError(null)
    if (!draft.transfer && !article) return setError("Статья (Turi) ro'yxatdan tanlanmagan")
    if (draft.transfer && (!draft.accountId || !draft.toAccountId)) return setError("O'tkazma uchun qaysi hisobdan va qaysi hisobga ekanini tanlang")
    if (!draft.noDate && !draft.date) return setError('Sanani kiriting')
    if (draft.amount === null && !(draft.usd && draft.rate)) return setError('Summani kiriting')

    const body: TransactionInput = {
      is_plan: isPlan,
      date: draft.noDate ? null : draft.date,
      pnl_month: draft.pnlMonth || null,
      article_id: draft.transfer ? null : article!.id,
      account_id: draft.accountId,
      to_account_id: draft.transfer ? draft.toAccountId : null,
      usd: draft.usd,
      usd_rate: draft.rate,
      amount: draft.amount,
      project_name: draft.project.trim() || null,
      comment: draft.comment.trim() || null,
      transfer: draft.transfer,
    }
    setSaving(true)
    try {
      const saved = editing
        ? await api.put<Transaction>(`/api/transactions/${editing.id}`, body)
        : await api.post<Transaction>('/api/transactions', body)
      onSaved(saved, !editing)
      if (!editing) setDraft(emptyDraft(draft.transfer || transferOnly, draft))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const incomeArticles = meta.articles.filter(a => a.type === 'ДОХОД')
  const expenseArticles = meta.articles.filter(a => a.type === 'РАСХОД')

  return (
    <form onSubmit={submit} className={`rounded-lg border bg-white p-4 shadow-sm ${editing ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-700">
          {editing ? `Tahrirlash: ${editing.date ? editing.date.split('-').reverse().join('.') : 'sanasiz'} · ${editing.article_name ?? ''}` :
            transferOnly ? "Yangi o'tkazma" : isPlan ? 'Yangi reja operatsiyasi' : 'Yangi operatsiya'}
        </h2>
        <div className="flex items-center gap-4">
          {!transferOnly && (
            <Toggle checked={draft.transfer} onChange={v => set('transfer', v)} label="Перевод (hisoblar o'rtasida)" />
          )}
          {!draft.transfer && (
            <Toggle checked={draft.noDate} onChange={v => set('noDate', v)} label="Sanasiz (faqat P&L hisoblash)" />
          )}
        </div>
      </div>
      <ErrorBox message={error} onClose={() => setError(null)} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Field label="Qaysi sanada">
          <Input type="date" value={draft.noDate ? '' : draft.date} disabled={draft.noDate}
            onChange={e => {
              const v = e.target.value
              setDraft(d => ({ ...d, date: v, pnlMonth: !editing && v && (!d.pnlMonth || d.pnlMonth === monthIso(d.date || v)) ? monthIso(v) : d.pnlMonth, rate: d.usd ? null : d.rate }))
            }} />
        </Field>
        <Field label="Qaysi oy uchun (P&L)">
          <Input type="month" value={draft.pnlMonth} onChange={e => set('pnlMonth', e.target.value)} />
        </Field>
        {draft.transfer ? (
          <>
            <Field label="Со счета (−)" className="col-span-1 xl:col-span-2">
              <Select value={draft.accountId ?? ''} onChange={e => set('accountId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— tanlang —</option>
                {meta.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
            <Field label="На счет (+)">
              <Select value={draft.toAccountId ?? ''} onChange={e => set('toAccountId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">— tanlang —</option>
                {meta.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </>
        ) : (
          <>
            <Field label="Turi (СТАТЬЯ)" className="col-span-2">
              <Input list="article-options" value={draft.articleText} placeholder="Yozing yoki tanlang…"
                onChange={e => set('articleText', e.target.value)}
                className={draft.articleText && !article ? 'border-amber-400' : ''} />
              <datalist id="article-options">
                {[...incomeArticles, ...expenseArticles].map(a => <option key={a.id} value={a.full_name} />)}
              </datalist>
            </Field>
            <Field label="To'lov turi (СЧЕТ)">
              <Select value={draft.accountId ?? ''} onChange={e => set('accountId', e.target.value ? Number(e.target.value) : null)}>
                <option value="">{draft.noDate ? '— (sanasiz) —' : '— tanlang —'}</option>
                {meta.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            </Field>
          </>
        )}
        <Field label="Доллар">
          <NumberInput decimals value={draft.usd} onChange={v => setDraft(d => ({ ...d, usd: v, amountTouched: v ? false : d.amountTouched }))} />
        </Field>
        <Field label="Курс доллар">
          <NumberInput decimals value={draft.rate} onChange={v => set('rate', v)} placeholder={draft.usd ? 'Kurs…' : ''} />
        </Field>
        <Field label="Summa (so'm)">
          <NumberInput value={draft.amount} onChange={v => setDraft(d => ({ ...d, amount: v, amountTouched: true }))} className="font-semibold" />
        </Field>
        <Field label="Kim uchun to'lov (o'quvchi F.I.Sh / proyekt)" className="col-span-2">
          <Input list="project-options" value={draft.project} onChange={e => set('project', e.target.value)} placeholder="Ixtiyoriy" />
          <datalist id="project-options">
            {meta.projects.map(p => <option key={p.id} value={p.name}>{p.customer ?? ''}</option>)}
          </datalist>
          {!projectExists && <span className="text-xs text-amber-600">Yangi loyiha sifatida P&L ro'yxatiga qo'shiladi</span>}
        </Field>
        <Field label="КОММЕНТАРИЙ / Check linki" className="col-span-2 md:col-span-4 xl:col-span-4">
          <Input value={draft.comment} onChange={e => set('comment', e.target.value)} />
        </Field>
        <div className="col-span-2 flex items-end gap-2">
          <Button type="submit" variant="primary" disabled={saving}>
            {editing ? <Save className="h-4 w-4" /> : draft.transfer ? <ArrowLeftRight className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {editing ? 'Saqlash' : "Qo'shish"}
          </Button>
          {(editing || copyFrom) && (
            <Button onClick={() => { setDraft(emptyDraft(transferOnly)); onCancel() }}><X className="h-4 w-4" />Bekor qilish</Button>
          )}
        </div>
      </div>
    </form>
  )
}
