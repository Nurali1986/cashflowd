import { useState } from 'react'
import { AlertTriangle, Copy, Pencil, Trash2 } from 'lucide-react'
import type { Transaction } from '../api'
import { decimal, dmy, money } from '../format'
import { IconButton, KindBadge } from '../ui'
import { ReceiptCell, ReceiptViewer } from './Receipts'

export default function TransactionTable({ rows, onEdit, onCopy, onDelete, editingId, compact = false }: {
  rows: Transaction[]
  onEdit?: (t: Transaction) => void
  onCopy?: (t: Transaction) => void
  onDelete?: (t: Transaction) => void
  editingId?: number | null
  compact?: boolean
}) {
  const actions = onEdit || onCopy || onDelete
  const [viewing, setViewing] = useState<Transaction | null>(null)
  return (
    <div className="overflow-auto">
      {viewing && <ReceiptViewer t={viewing} onClose={() => setViewing(null)} onChanged={setViewing} />}
      <table className="sheet w-full min-w-[1100px]">
        <thead>
          <tr>
            <th>Qaysi sanada</th>
            <th>P&L oyi</th>
            <th>Turi (СТАТЬЯ)</th>
            <th>СЧЕТ</th>
            {!compact && <th className="num">Доллар</th>}
            {!compact && <th className="num">Курс</th>}
            <th className="num">Summa</th>
            <th>Kim uchun (Proyekt)</th>
            <th>КОММЕНТАРИЙ</th>
            <th title="Chek (rasm / link) va tekshiruv">Chek</th>
            {!compact && <th>МЕСЯЦ ДДС</th>}
            {actions && <th className="w-24"></th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className={editingId === t.id ? 'editing' : ''}>
              <td className="whitespace-nowrap">
                {t.date ? dmy(t.date) : <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700" title="Sanasiz: faqat P&L ga kiradi, kassaga kirmaydi">sanasiz</span>}
              </td>
              <td className="whitespace-nowrap text-slate-600">
                {t.pnl_month_label}
                {t.effective_pnl_label !== t.pnl_month_label && (
                  <div className="text-[11px] text-slate-400">ОПУ: {t.effective_pnl_label || '—'}</div>
                )}
              </td>
              <td>
                <div className="flex items-center gap-1.5">
                  <KindBadge kind={t.kind} />
                  <span className="max-w-[340px] truncate" title={t.article_name ?? ''}>
                    {t.kind === 'ПЕРЕВОД' ? `${t.account_name ?? '?'} → ${t.to_account_name ?? '?'}` : t.article_name?.replace(/^(ДОХОД|РАСХОД)\. /, '')}
                  </span>
                  {t.import_warning && (
                    <span title={t.import_warning}><AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" /></span>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap">{t.kind === 'ПЕРЕВОД' ? '' : t.account_name}</td>
              {!compact && <td className="num">{decimal(t.usd)}</td>}
              {!compact && <td className="num text-slate-500">{t.usd ? decimal(t.usd_rate) : ''}</td>}
              <td className={`num font-medium ${t.kind === 'ДОХОД' ? 'text-emerald-700' : t.kind === 'РАСХОД' ? 'text-rose-700' : 'text-sky-700'}`}>
                {money(t.amount)}
              </td>
              <td className="max-w-[220px] truncate" title={t.project_name ?? ''}>{t.project_name}</td>
              <td className="max-w-[260px] truncate text-slate-600" title={t.comment ?? ''}>
                {t.comment && /^https?:\/\//.test(t.comment) ? <a href={t.comment} target="_blank" rel="noreferrer" className="text-sky-600 underline">havola</a> : t.comment}
              </td>
              <td className="whitespace-nowrap"><ReceiptCell t={t} onOpen={() => setViewing(t)} /></td>
              {!compact && <td className="whitespace-nowrap text-slate-500">{t.cf_month_label}</td>}
              {actions && (
                <td className="whitespace-nowrap text-right">
                  {onEdit && <IconButton title="Tahrirlash" onClick={() => onEdit(t)}><Pencil className="h-3.5 w-3.5" /></IconButton>}
                  {onCopy && <IconButton title="Nusxa olish" onClick={() => onCopy(t)}><Copy className="h-3.5 w-3.5" /></IconButton>}
                  {onDelete && <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => onDelete(t)}><Trash2 className="h-3.5 w-3.5" /></IconButton>}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
