import { useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import {
  ArrowLeftRight, BarChart3, BookOpen, CalendarDays, CalendarRange, DollarSign, Download, FileSpreadsheet,
  FolderKanban, Gauge, Landmark, LineChart, ListTree, Menu, NotebookPen, PieChart, Settings, Table2, Upload, Wallet, X,
} from 'lucide-react'
import { api } from './api'
import { useMeta } from './meta'
import { ErrorBox, Spinner } from './ui'
import CashFlowPage from './pages/CashFlowPage'
import ProjectsPage from './pages/ProjectsPage'
import KassaPage from './pages/KassaPage'
import KursPage from './pages/KursPage'
import CashflowDailyPage from './pages/CashflowDailyPage'
import CashflowMonthlyPage from './pages/CashflowMonthlyPage'
import PnlMonthlyPage from './pages/PnlMonthlyPage'
import ProjectReportPage from './pages/ProjectReportPage'
import DashboardPage from './pages/DashboardPage'
import SettingsPage from './pages/SettingsPage'
import DirectoryPage from './pages/DirectoryPage'
import TransfersPage from './pages/TransfersPage'
import BackendPage from './pages/BackendPage'
import DashboardDataPage from './pages/DashboardDataPage'

interface SheetLink { to: string; label: string; icon: typeof Table2; hint: string }

// One page per sheet of «Pifagor - Cash flow - P&L.xlsx».
const GROUPS: { title: string; links: SheetLink[] }[] = [
  {
    title: 'Kiritish',
    links: [
      { to: '/cash-flow', label: 'Cash flow', icon: Table2, hint: 'Barcha pul operatsiyalari' },
      { to: '/pnl', label: 'P&L', icon: FolderKanban, hint: "Loyihalar / o'quvchilar" },
      { to: '/pnl-reja', label: 'P&L Reja', icon: NotebookPen, hint: 'Rejalashtirilgan operatsiyalar' },
      { to: '/kurs', label: 'Kurs', icon: DollarSign, hint: 'Dollar kursi' },
      { to: '/perevodlar', label: 'Perevodlar', icon: ArrowLeftRight, hint: "Hisoblar o'rtasida o'tkazmalar" },
    ],
  },
  {
    title: 'Hisobotlar',
    links: [
      { to: '/kassa', label: 'Kassa', icon: Wallet, hint: 'Hisoblar qoldig\'i' },
      { to: '/cash-flow-kunlik', label: 'Cash flow kunlik', icon: CalendarDays, hint: 'Kunlik ДДС' },
      { to: '/cash-flow-oylik', label: 'Cash flow oylik', icon: CalendarRange, hint: 'Oylik ДДС' },
      { to: '/pnl-oylik', label: 'P&L oylik', icon: BarChart3, hint: 'Oylik ОПУ (fakt / reja)' },
      { to: '/otchet', label: 'ОТЧЕТ по проекту', icon: BookOpen, hint: 'Bitta loyiha hisoboti' },
      { to: '/dashboard-pnl', label: 'Dashboard P&L', icon: PieChart, hint: 'ОПУ dashboard' },
      { to: '/dashboard-cash-flow', label: 'Dashboard Cash flow', icon: LineChart, hint: 'ДДС dashboard' },
    ],
  },
  {
    title: 'Sozlamalar',
    links: [
      { to: '/spravochnik', label: 'справочник', icon: Landmark, hint: 'Hisoblar, статьялар, ro\'yxatlar' },
      { to: '/nastroyki', label: 'настройки', icon: Settings, hint: 'Hisoblangan ro\'yxatlar' },
      { to: '/back-end', label: 'Back-end', icon: ListTree, hint: 'Davr bo\'yicha filtr' },
      { to: '/nastroyki-dashboard-opu', label: 'настройки(дашбордОПУ)', icon: Gauge, hint: 'Dashboard P&L ma\'lumotlari' },
      { to: '/nastroyki-dashboard-dds', label: 'настройки(дашбордДДС)', icon: Gauge, hint: 'Dashboard Cash flow ma\'lumotlari' },
    ],
  },
]

function ImportExport() {
  const { touch } = useMeta()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function upload(file: File) {
    if (!confirm(`«${file.name}» faylidan import qilinsinmi?\n\nDIQQAT: platformadagi BARCHA joriy ma'lumotlar Excel fayldagi ma'lumotlar bilan almashtiriladi.`)) return
    setBusy(true)
    setMessage(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const s = await api.post<Record<string, number>>('/api/import', form)
      setMessage(`Import tugadi: ${s.transactions} operatsiya, ${s.projects} loyiha, ${s.plan} reja, ${s.rates} kurs. Tekshirish kerak: ${s.warnings} qator.`)
      touch()
    } catch (e) {
      setMessage(`Xatolik: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-1 border-t border-slate-800 px-3 py-3">
      <a href="/api/export" className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white">
        <Download className="h-4 w-4" /> Excel'ga yuklab olish
      </a>
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-50">
        <Upload className="h-4 w-4" /> {busy ? 'Import qilinmoqda…' : "Excel'dan import"}
      </button>
      <input ref={fileRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
      {message && <p className="px-2 text-xs text-slate-400">{message}</p>}
    </div>
  )
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { meta } = useMeta()
  return (
    <div className="flex h-full flex-col bg-slate-900 text-slate-300">
      <div className="flex items-center gap-2 px-4 py-4">
        <FileSpreadsheet className="h-6 w-6 text-emerald-400" />
        <div>
          <div className="text-sm font-semibold text-white">{meta?.settings.company_name || 'Pifagor'}</div>
          <div className="text-xs text-slate-400">Cash flow · P&L</div>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {GROUPS.map(g => (
          <div key={g.title}>
            <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.title}</div>
            {g.links.map(l => (
              <NavLink key={l.to} to={l.to} onClick={onNavigate} title={l.hint}
                className={({ isActive }) => `flex items-center gap-2 rounded px-2 py-1.5 text-sm ${isActive ? 'bg-emerald-600 text-white' : 'hover:bg-slate-800 hover:text-white'}`}>
                <l.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{l.label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <ImportExport />
    </div>
  )
}

export default function App() {
  const { meta, error } = useMeta()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden w-60 shrink-0 lg:block"><Sidebar onNavigate={() => {}} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div className="w-64"><Sidebar onNavigate={() => setOpen(false)} /></div>
          <button className="flex-1 bg-black/40" onClick={() => setOpen(false)} aria-label="Yopish"><X className="m-3 h-5 w-5 text-white" /></button>
        </div>
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Menyu"><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-semibold">Pifagor · Cash flow & P&L</span>
        </div>
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {error && <ErrorBox message={`Server bilan aloqa yo'q: ${error}`} />}
          {!meta ? (!error && <Spinner />) : (
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard-pnl" replace />} />
              <Route path="/cash-flow" element={<CashFlowPage isPlan={false} />} />
              <Route path="/pnl" element={<ProjectsPage />} />
              <Route path="/pnl-reja" element={<CashFlowPage isPlan />} />
              <Route path="/kurs" element={<KursPage />} />
              <Route path="/perevodlar" element={<TransfersPage />} />
              <Route path="/kassa" element={<KassaPage />} />
              <Route path="/cash-flow-kunlik" element={<CashflowDailyPage />} />
              <Route path="/cash-flow-oylik" element={<CashflowMonthlyPage />} />
              <Route path="/pnl-oylik" element={<PnlMonthlyPage />} />
              <Route path="/otchet" element={<ProjectReportPage />} />
              <Route path="/otchet/:projectId" element={<ProjectReportPage />} />
              <Route path="/dashboard-pnl" element={<DashboardPage variant="pnl" />} />
              <Route path="/dashboard-cash-flow" element={<DashboardPage variant="cashflow" />} />
              <Route path="/spravochnik" element={<DirectoryPage />} />
              <Route path="/nastroyki" element={<SettingsPage />} />
              <Route path="/back-end" element={<BackendPage />} />
              <Route path="/nastroyki-dashboard-opu" element={<DashboardDataPage variant="pnl" />} />
              <Route path="/nastroyki-dashboard-dds" element={<DashboardDataPage variant="cashflow" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </div>
      </main>
    </div>
  )
}
