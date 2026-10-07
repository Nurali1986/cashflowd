import { api, type Transaction, type TransactionPage } from '../api'
import { useState } from 'react'
import { money } from '../format'
import { useData, useMeta } from '../meta'
import TransactionForm from '../components/TransactionForm'
import TransactionTable from '../components/TransactionTable'
import { Card, Empty, ErrorBox, PageHeader, Spinner } from '../ui'

export default function TransfersPage() {
  const { touch } = useMeta()
  const { data, error: loadError } = useData<TransactionPage>('/api/transactions?kind=ПЕРЕВОД&limit=1000')
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function remove(t: Transaction) {
    if (!confirm(`O'tkazma o'chirilsinmi? ${money(t.amount)} so'm`)) return
    try { await api.del(`/api/transactions/${t.id}`); touch() } catch (e) { setError((e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Perevodlar" subtitle="Hisoblar o'rtasidagi o'tkazmalar (masalan, Naqd → Bank hisobi). Ular daromad/xarajat emas: umumiy balans o'zgarmaydi, faqat hisoblar qoldig'i o'zgaradi." />
      <TransactionForm isPlan={false} transferOnly editing={editing} copyFrom={null}
        onSaved={() => { setEditing(null); touch() }} onCancel={() => setEditing(null)} />
      <ErrorBox message={error ?? loadError} onClose={() => setError(null)} />
      <Card title={data ? `O'tkazmalar: ${data.total} · jami ${money(data.sum_transfer)} so'm` : 'O\'tkazmalar'}>
        {!data ? <Spinner /> : data.items.length === 0 ? <Empty>Hali o'tkazmalar yo'q</Empty> :
          <TransactionTable rows={data.items} editingId={editing?.id} onEdit={setEditing} onDelete={remove} />}
      </Card>
    </div>
  )
}
