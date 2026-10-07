import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { decimal, money, parseNumber } from './format'
import { useMeta } from './meta'

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
          {actions}
        </header>
      )}
      {children}
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'
const variants: Record<Variant, string> = {
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600',
  secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-300',
  danger: 'bg-white text-rose-600 hover:bg-rose-50 border-rose-200',
  ghost: 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800 border-transparent',
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    />
  )
}

export function IconButton({ title, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { title: string }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      {...props}
      className={`inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 ${className}`}
    />
  )
}

const widthOf = (cls?: string) => (cls && /(^|\s)(w-|min-w-)/.test(cls) ? '' : 'w-full')

export const inputClass =
  'rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50'

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${widthOf(props.className)} ${props.className ?? ''}`} />
}

export function Select({ children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={`${inputClass} ${widthOf(props.className)} pr-7 ${props.className ?? ''}`}>
      {children}
    </select>
  )
}

export function Field({ label, children, className = '' }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  )
}

/** Number input that shows "1 234 567" and reports a parsed number (null when empty). */
export function NumberInput({ value, onChange, decimals = false, ...props }:
  Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: number | null; onChange: (v: number | null) => void; decimals?: boolean }) {
  const show = (v: number | null) => (v === null ? '' : decimals ? decimal(v) : money(v))
  const [text, setText] = useState(show(value))
  const [focused, setFocused] = useState(false)
  useEffect(() => { if (!focused) setText(show(value)) }, [value, focused]) // eslint-disable-line react-hooks/exhaustive-deps
  const parsed = parseNumber(text)
  return (
    <input
      {...props}
      inputMode="decimal"
      value={text}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); setText(show(value)) }}
      onChange={e => {
        setText(e.target.value)
        const n = parseNumber(e.target.value)
        if (n === null || !Number.isNaN(n)) onChange(n)
      }}
      className={`${inputClass} ${widthOf(props.className)} text-right tabular-nums ${parsed !== null && Number.isNaN(parsed) ? 'border-rose-400' : ''} ${props.className ?? ''}`}
    />
  )
}

export function Spinner({ label = 'Yuklanmoqda…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> {label}
    </div>
  )
}

export function ErrorBox({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null
  return (
    <div className="mb-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onClose && <button onClick={onClose} aria-label="Yopish"><X className="h-4 w-4" /></button>}
    </div>
  )
}

export function KindBadge({ kind }: { kind: string | null }) {
  if (!kind) return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">статья yo'q</span>
  const cls = kind === 'ДОХОД' ? 'bg-emerald-100 text-emerald-800' : kind === 'РАСХОД' ? 'bg-rose-100 text-rose-800' : 'bg-sky-100 text-sky-800'
  return <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`}>{kind}</span>
}

export function Stat({ label, value, tone = 'slate', hint }: { label: string; value: ReactNode; tone?: 'slate' | 'green' | 'red' | 'blue'; hint?: ReactNode }) {
  const color = { slate: 'text-slate-900', green: 'text-emerald-600', red: 'text-rose-600', blue: 'text-sky-700' }[tone]
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

export function YearSelect({ value, onChange }: { value: number; onChange: (y: number) => void }) {
  const { meta } = useMeta()
  const years = Array.from(new Set([...meta.years, value])).sort()
  return (
    <Select value={value} onChange={e => onChange(Number(e.target.value))} className="w-24">
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </Select>
  )
}

export function AccountSelect({ value, onChange, allLabel = 'ВСЕ СЧЕТА' }: { value: number | null; onChange: (v: number | null) => void; allLabel?: string }) {
  const { meta } = useMeta()
  return (
    <Select value={value ?? ''} onChange={e => onChange(e.target.value ? Number(e.target.value) : null)} className="w-44">
      <option value="">{allLabel}</option>
      {meta.accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
    </Select>
  )
}

export const MODES: { value: string; label: string }[] = [
  { value: 'all', label: 'ВСЕ ОПЕРАЦИИ' },
  { value: 'projects', label: 'ПРОЕКТЫ' },
  { value: 'company', label: 'КОМПАНИЯ' },
]

export function ModeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Select value={value} onChange={e => onChange(e.target.value)} className="w-40">
      {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
    </Select>
  )
}

export function Money({ value, className = '', empty = '' }: { value: number | null | undefined; className?: string; empty?: string }) {
  return <span className={`tabular-nums ${value && value < 0 ? 'text-rose-600' : ''} ${className}`}>{money(value, empty)}</span>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-10 text-center text-sm text-slate-400">{children}</div>
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
      <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={checked} onChange={e => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
