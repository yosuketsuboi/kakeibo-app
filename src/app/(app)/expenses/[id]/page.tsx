'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { useParams, useRouter } from 'next/navigation'

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>()
  const { household, categories } = useHousehold()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseDate, setExpenseDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!household) return
    loadExpense()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, household])

  async function loadExpense() {
    const supabase = createClient()
    const { data } = await supabase
      .from('manual_expenses')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setAmount(data.amount.toString())
      setDescription(data.description)
      setCategoryId(data.category_id || '')
      setExpenseDate(data.expense_date)
    }
    setLoading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const supabase = createClient()
    await supabase
      .from('manual_expenses')
      .update({
        amount: Number(amount),
        description,
        category_id: categoryId || null,
        expense_date: expenseDate,
      })
      .eq('id', id)

    router.push('/expenses')
  }

  async function handleDelete() {
    if (!confirm('この支出を削除しますか？')) return
    const supabase = createClient()
    await supabase.from('manual_expenses').delete().eq('id', id)
    router.push('/expenses')
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">支出編集</h1>
        <button onClick={handleDelete} className="text-red-500 text-sm">
          削除
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">金額</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min={1}
            className="w-full px-3 py-2 border rounded-lg text-lg"
            inputMode="numeric"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">内容</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">カテゴリ</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">未分類</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">日付</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存する'}
        </button>
      </form>
    </div>
  )
}
