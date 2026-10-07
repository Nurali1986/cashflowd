import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api, type Rate } from '../api'
import { decimal, dmy, todayIso } from '../format'
import { useData, useMeta } from '../meta'
import { Button, Card, Empty, ErrorBox, Field, IconButton, Input, NumberInput, PageHeader, Spinner } from '../ui'

export default function KursPage() {
  const { touch } = useMeta()
  const { data, error: loadError } = useData<Rate[]>('/api/rates')
  const [date, setDate] = useState(todayIso())
  const [rate, setRate] = useState<number | null>(null)
  const [edit, setEdit] = useState<Rate | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function add() {
    if (!date || !rate) return setError('Sana va kursni kiriting')
    try {
      await api.post('/api/rates', { date, rate })
      setRate(null)
      setError(null)
      touch()
    } catch (e) { setError((e as Error).message) }
  }

  async function saveEdit() {
    if (!edit) return
    try {
      await api.put(`/api/rates/${edit.id}`, { date: edit.date, rate: edit.rate })
      setEdit(null)
      touch()
    } catch (e) { setError((e as Error).message) }
  }

  async function remove(r: Rate) {
    if (!confirm(`${dmy(r.date)} kursi o'chirilsinmi?`)) return
    await api.del(`/api/rates/${r.id}`)
    touch()
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Kurs" subtitle="Dollar kursi (so'm). Cash flow'da dollar summasi kiritilganda shu sana (yoki undan oldingi eng yaqin sana) kursi avtomatik qo'yiladi." />
      <Card>
        <form className="flex flex-wrap items-end gap-3 p-3" onSubmit={e => { e.preventDefault(); void add() }}>
          <Field label="Sana"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Field label="Dollar kursi"><NumberInput decimals value={rate} onChange={setRate} className="w-40" /></Field>
          <Button type="submit" variant="primary"><Plus className="h-4 w-4" />Qo'shish</Button>
          <span className="text-xs text-slate-500">Shu sana uchun kurs bo'lsa — yangilanadi.</span>
        </form>
      </Card>
      <ErrorBox message={error ?? loadError} onClose={() => setError(null)} />
      <Card>
        {!data ? <Spinner /> : data.length === 0 ? <Empty>Kurslar kiritilmagan</Empty> : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="sheet w-full">
              <thead><tr><th>Sana</th><th className="num">Dollar</th><th className="w-24"></th></tr></thead>
              <tbody>
                {data.map(r => edit?.id === r.id ? (
                  <tr key={r.id} className="editing">
                    <td><Input type="date" value={edit.date} onChange={e => setEdit({ ...edit, date: e.target.value })} className="w-40" /></td>
                    <td><NumberInput decimals value={edit.rate} onChange={v => setEdit({ ...edit, rate: v ?? 0 })} /></td>
                    <td className="text-right">
                      <IconButton title="Saqlash" onClick={saveEdit} className="text-emerald-600"><Check className="h-4 w-4" /></IconButton>
                      <IconButton title="Bekor qilish" onClick={() => setEdit(null)}><X className="h-4 w-4" /></IconButton>
                    </td>
                  </tr>
                ) : (
                  <tr key={r.id}>
                    <td>{dmy(r.date)}</td>
                    <td className="num">{decimal(r.rate)}</td>
                    <td className="text-right">
                      <IconButton title="Tahrirlash" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></IconButton>
                      <IconButton title="O'chirish" className="hover:text-rose-600" onClick={() => remove(r)}><Trash2 className="h-3.5 w-3.5" /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
