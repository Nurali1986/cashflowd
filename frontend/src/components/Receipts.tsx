import { useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, ExternalLink, FileText, ImagePlus, Link2, Paperclip, Trash2, X } from 'lucide-react'
import { api, type Receipt, type Transaction } from '../api'
import { dmy, money } from '../format'
import { useMeta } from '../meta'
import { Button, ErrorBox, IconButton, Input, KindBadge } from '../ui'

export const RECEIPT_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/heif,image/gif,application/pdf'

export const fileUrl = (r: Receipt) => `/api/receipts/${r.id}/file`
const isImage = (r: Receipt) => r.kind === 'file' && (r.content_type ?? '').startsWith('image/') && !/hei[cf]/.test(r.content_type ?? '')

export function uploadReceipt(txId: number, file: File) {
  const form = new FormData()
  form.append('file', file)
  return api.post<Receipt>(`/api/transactions/${txId}/receipts`, form)
}

export function addReceiptLink(txId: number, url: string) {
  return api.post<Receipt>(`/api/transactions/${txId}/receipts/link`, { url })
}

/** Pick photos/PDFs and links in the entry form; they are uploaded once the operation is saved. */
export function ReceiptPicker({ files, links, existing, onFiles, onLinks, onRemoveExisting }: {
  files: File[]
  links: string[]
  existing: Receipt[]
  onFiles: (f: File[]) => void
  onLinks: (l: string[]) => void
  onRemoveExisting: (r: Receipt) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')
  const [linkError, setLinkError] = useState(false)

  function addLink() {
    const v = link.trim()
    if (!v) return
    if (!/^https?:\/\//i.test(v)) { setLinkError(true); return }
    onLinks([...links, v])
    setLink('')
    setLinkError(false)
  }

  const chip = 'inline-flex max-w-[260px] items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-0.5 pl-2 pr-1 text-xs text-slate-700'
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4" />Chek rasmi / PDF</Button>
        <input ref={inputRef} type="file" multiple accept={RECEIPT_ACCEPT} className="hidden"
          onChange={e => { onFiles([...files, ...Array.from(e.target.files ?? [])]); e.target.value = '' }} />
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <Input value={link} placeholder="Chek linki: https://…" onChange={e => { setLink(e.target.value); setLinkError(false) }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }} className={linkError ? 'border-rose-400' : ''} />
          <Button onClick={addLink}><Link2 className="h-4 w-4" />Ulash</Button>
        </div>
      </div>
      {linkError && <p className="text-xs text-rose-600">Link http:// yoki https:// bilan boshlanishi kerak</p>}
      {(existing.length > 0 || files.length > 0 || links.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {existing.map(r => (
            <span key={`e${r.id}`} className={chip}>
              {r.kind === 'link' ? <Link2 className="h-3 w-3 shrink-0" /> : <Paperclip className="h-3 w-3 shrink-0" />}
              <a href={r.kind === 'link' ? r.url! : fileUrl(r)} target="_blank" rel="noreferrer" className="truncate hover:underline">{r.kind === 'link' ? r.url : r.filename}</a>
              <button type="button" title="O'chirish" onClick={() => onRemoveExisting(r)} className="rounded-full p-0.5 hover:bg-slate-200"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {files.map((f, i) => (
            <span key={`f${i}`} className={`${chip} border-emerald-200 bg-emerald-50`}>
              <Paperclip className="h-3 w-3 shrink-0" /><span className="truncate">{f.name}</span>
              <button type="button" title="Olib tashlash" onClick={() => onFiles(files.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-emerald-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
          {links.map((l, i) => (
            <span key={`l${i}`} className={`${chip} border-emerald-200 bg-emerald-50`}>
              <Link2 className="h-3 w-3 shrink-0" /><span className="truncate">{l}</span>
              <button type="button" title="Olib tashlash" onClick={() => onLinks(links.filter((_, j) => j !== i))} className="rounded-full p-0.5 hover:bg-emerald-100"><X className="h-3 w-3" /></button>
            </span>
          ))}
        </div>
      )}
      {(files.length > 0 || links.length > 0) && <p className="text-xs text-emerald-700">Yashil belgilanganlar operatsiya saqlanganda yuklanadi.</p>}
    </div>
  )
}

/** Small table cell: receipt count + verified mark; click opens the viewer. */
export function ReceiptCell({ t, onOpen }: { t: Transaction; onOpen: () => void }) {
  const n = t.receipts.length
  return (
    <button type="button" onClick={onOpen} title={n ? `Chek: ${n} ta — ochish` : "Chek yo'q — qo'shish"}
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${n ? 'text-sky-700 hover:bg-sky-50' : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'}`}>
      <Paperclip className="h-3.5 w-3.5" />{n || ''}
      {t.verified_at && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-label="Tekshirilgan" />}
    </button>
  )
}

/** Reviewer view: the payment's data next to its receipts, with the «Tekshirildi» switch. */
export function ReceiptViewer({ t, onClose, onChanged }: { t: Transaction; onClose: () => void; onChanged: (t: Transaction) => void }) {
  const { touch } = useMeta()
  const [tx, setTx] = useState(t)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [link, setLink] = useState('')

  async function reload() {
    const fresh = await api.get<Transaction>(`/api/transactions/${tx.id}`)
    setTx(fresh)
    onChanged(fresh)
    touch()
  }

  async function act(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try { await fn(); await reload() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  const toggleVerified = () => act(async () => {
    const updated = await api.put<Transaction>(`/api/transactions/${tx.id}/verified?verified=${!tx.verified_at}`)
    setTx(updated)
  })

  const rows: [string, ReactNode][] = [
    ['Sana', tx.date ? dmy(tx.date) : 'sanasiz'],
    ['P&L oyi', tx.pnl_month_label],
    ['Turi (СТАТЬЯ)', <span className="flex items-center gap-1.5"><KindBadge kind={tx.kind} />{tx.article_name?.replace(/^(ДОХОД|РАСХОД)\. /, '')}</span>],
    ['СЧЕТ', tx.kind === 'ПЕРЕВОД' ? `${tx.account_name} → ${tx.to_account_name}` : tx.account_name ?? '—'],
    ['Kim uchun', tx.project_name ?? '—'],
    ['Izoh', tx.comment ?? '—'],
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 md:p-6" onClick={onClose}>
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-800">Chekni tekshirish</h2>
          <IconButton title="Yopish" onClick={onClose}><X className="h-5 w-5" /></IconButton>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto md:grid-cols-[320px_1fr] md:overflow-hidden">
          <aside className="space-y-4 border-b border-slate-200 p-4 md:overflow-auto md:border-b-0 md:border-r">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Summa</div>
              <div className="text-3xl font-semibold tabular-nums">{money(tx.amount)} <span className="text-base font-normal text-slate-500">so'm</span></div>
              {tx.usd ? <div className="text-sm text-slate-500">$ {tx.usd} × {money(tx.usd_rate)}</div> : null}
            </div>
            <dl className="space-y-2 text-sm">
              {rows.map(([k, v]) => <div key={k}><dt className="text-xs text-slate-500">{k}</dt><dd className="text-slate-800">{v}</dd></div>)}
            </dl>
            <button type="button" disabled={busy} onClick={toggleVerified}
              className={`flex w-full items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition ${tx.verified_at ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
              <CheckCircle2 className="h-4 w-4" />{tx.verified_at ? `Tekshirildi · ${dmy(tx.verified_at.slice(0, 10))}` : 'Chek bilan mos — tekshirildi deb belgilash'}
            </button>
            {!tx.receipts.length && <p className="text-xs text-amber-700">Bu operatsiyaga hali chek biriktirilmagan.</p>}
          </aside>
          <section className="space-y-4 p-4 md:overflow-auto">
            <ErrorBox message={error} onClose={() => setError(null)} />
            <div className="flex flex-wrap items-center gap-2">
              <Button disabled={busy} onClick={() => inputRef.current?.click()}><ImagePlus className="h-4 w-4" />Rasm / PDF yuklash</Button>
              <input ref={inputRef} type="file" multiple accept={RECEIPT_ACCEPT} className="hidden"
                onChange={e => { const fs = Array.from(e.target.files ?? []); e.target.value = ''; void act(async () => { for (const f of fs) await uploadReceipt(tx.id, f) }) }} />
              <form className="flex min-w-[260px] flex-1 gap-2" onSubmit={e => { e.preventDefault(); if (link.trim()) void act(async () => { await addReceiptLink(tx.id, link.trim()); setLink('') }) }}>
                <Input value={link} onChange={e => setLink(e.target.value)} placeholder="Chek linki: https://…" />
                <Button type="submit" disabled={busy}><Link2 className="h-4 w-4" />Ulash</Button>
              </form>
            </div>
            {tx.receipts.map(r => (
              <figure key={r.id} className="overflow-hidden rounded-lg border border-slate-200">
                <figcaption className="flex items-center justify-between gap-2 bg-slate-50 px-3 py-1.5 text-sm">
                  <span className="flex min-w-0 items-center gap-1.5 text-slate-700">
                    {r.kind === 'link' ? <Link2 className="h-4 w-4 shrink-0" /> : r.content_type === 'application/pdf' ? <FileText className="h-4 w-4 shrink-0" /> : <Paperclip className="h-4 w-4 shrink-0" />}
                    <span className="truncate">{r.kind === 'link' ? r.url : r.filename}</span>
                  </span>
                  <span className="flex shrink-0 items-center">
                    <a href={r.kind === 'link' ? r.url! : fileUrl(r)} target="_blank" rel="noreferrer" title="Yangi oynada ochish"
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-200"><ExternalLink className="h-4 w-4" /></a>
                    <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => { if (confirm("Chek o'chirilsinmi?")) void act(() => api.del(`/api/receipts/${r.id}`)) }}><Trash2 className="h-4 w-4" /></IconButton>
                  </span>
                </figcaption>
                {isImage(r) ? (
                  <a href={fileUrl(r)} target="_blank" rel="noreferrer"><img src={fileUrl(r)} alt={r.filename ?? 'chek'} className="max-h-[70vh] w-full bg-slate-100 object-contain" /></a>
                ) : r.content_type === 'application/pdf' ? (
                  <iframe src={fileUrl(r)} title={r.filename ?? 'chek'} className="h-[70vh] w-full" />
                ) : r.kind === 'link' ? (
                  <div className="p-4">
                    <a href={r.url!} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700">
                      <ExternalLink className="h-4 w-4" />Chek linkini ochish
                    </a>
                    <p className="mt-2 break-all text-xs text-slate-500">{r.url}</p>
                  </div>
                ) : (
                  <div className="p-4 text-sm text-slate-500">Bu formatni brauzer ko'rsatmaydi — <a className="text-sky-600 underline" href={fileUrl(r)}>yuklab oling</a>.</div>
                )}
              </figure>
            ))}
          </section>
        </div>
      </div>
    </div>
  )
}
