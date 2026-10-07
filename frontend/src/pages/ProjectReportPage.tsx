import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { query, type Project, type TransactionPage } from '../api'
import { dmy, money, percent } from '../format'
import { useData, useMeta } from '../meta'
import TransactionTable from '../components/TransactionTable'
import { Card, Empty, ErrorBox, Field, Input, Money, PageHeader, Select, Spinner } from '../ui'

export default function ProjectReportPage() {
  const { meta } = useMeta()
  const { projectId } = useParams()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [articleId, setArticleId] = useState('')

  const current = meta.projects.find(p => String(p.id) === projectId) ?? null
  useEffect(() => { setText(current?.name ?? '') }, [current?.name])

  const { data: project, error } = useData<Project>(projectId ? `/api/projects/${projectId}` : null, [projectId])
  const { data: ops } = useData<TransactionPage>(projectId
    ? `/api/transactions${query({ project_id: projectId, article_id: articleId, limit: 5000, sort: 'date_asc' })}` : null, [projectId, articleId])

  const usedArticles = ops ? Array.from(new Map(ops.items.filter(t => t.article_id).map(t => [t.article_id, t.article_name])).entries()) : []

  function choose(name: string) {
    setText(name)
    const p = meta.projects.find(x => x.name.toLowerCase() === name.trim().toLowerCase())
    if (p) { setArticleId(''); navigate(`/otchet/${p.id}`) }
  }

  const info: [string, ReactNode][] = project ? [
    ['Текущий статус', project.status ?? '–'],
    ['Дата заказа', dmy(project.order_date) || '–'],
    ['Заказчик (sinf)', project.customer ?? '–'],
    ['Описание', project.description ?? '–'],
    ['Категория', project.category ?? '–'],
    ['Дата закрытия', dmy(project.close_date) || '–'],
    ['Комментарий', project.comment ?? '–'],
  ] : []
  const finance: [string, ReactNode][] = project ? [
    ['Стоимость проекта', <Money value={project.contract_amount} empty="–" />],
    ['Оплачено (факт)', <Money value={project.paid} className="text-emerald-700" />],
    ['Долг по оплате', <Money value={project.debt} className={project.debt > 0 ? 'text-rose-600' : ''} />],
    ['Расходы на проект', <Money value={project.expenses} />],
    ['Маржа', <Money value={project.margin} />],
    ['Рентабельность, %', percent(project.profitability)],
  ] : []

  return (
    <div className="space-y-4">
      <PageHeader title="ОТЧЕТ по проекту" subtitle="Bitta loyiha (o'quvchi) bo'yicha umumiy ma'lumot, moliyaviy natija va barcha operatsiyalar." />
      <Card>
        <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
          <Field label="Proyekt (o'quvchi)" className="md:col-span-2">
            <Input list="report-projects" value={text} onChange={e => choose(e.target.value)} placeholder="Ismni yozing…" />
            <datalist id="report-projects">{meta.projects.map(p => <option key={p.id} value={p.name}>{p.customer ?? ''}</option>)}</datalist>
          </Field>
          <Field label="СТАТЬЯ (ixtiyoriy)">
            <Select value={articleId} onChange={e => setArticleId(e.target.value)} disabled={!projectId}>
              <option value="">Barcha статьялар</option>
              {usedArticles.map(([id, name]) => <option key={id} value={id ?? ''}>{name}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <ErrorBox message={error} />
      {!projectId ? <Card><Empty>Hisobotni ko'rish uchun loyihani tanlang</Empty></Card> : !project ? <Spinner /> : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={<>ОБЩИЕ ДАННЫЕ — <span className="text-slate-900">{project.name}</span></>} actions={<Link to="/pnl" className="text-xs text-sky-600 hover:underline">P&L ro'yxati →</Link>}>
              <dl className="divide-y divide-slate-100 text-sm">
                {info.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
              </dl>
            </Card>
            <Card title="ФИНАНСЫ">
              <dl className="divide-y divide-slate-100 text-sm">
                {finance.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-2"><dt className="text-slate-500">{k}</dt><dd className="text-right font-semibold tabular-nums">{v}</dd></div>)}
              </dl>
            </Card>
          </div>
          <Card title={`ОПЕРАЦИИ (${ops?.total ?? 0})`} actions={ops && <span className="text-sm text-slate-600">Jami: <b>{money(ops.items.reduce((s, t) => s + t.amount, 0))}</b></span>}>
            {!ops ? <Spinner /> : ops.items.length === 0 ? <Empty>нет операции</Empty> : <TransactionTable rows={ops.items} compact />}
          </Card>
        </>
      )}
    </div>
  )
}
