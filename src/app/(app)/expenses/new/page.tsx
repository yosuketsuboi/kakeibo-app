'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { useRouter } from 'next/navigation'

export default function NewExpensePage() {
  const { household, categories } = useHousehold()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!household) return

    setSaving(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('認証エラー')
      setSaving(false)
      return
    }

    const { error: insertError } = await supabase.from('manual_expenses').insert({
      household_id: household.id,
      user_id: user.id,
      amount: Number(amount),
      description,
      category_id: categoryId || null,
      expense_date: expenseDate,
    })

    if (insertError) {
      setError('保存に失敗しました')
      setSaving(false)
      return
    }

    router.push('/expenses')
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">手動入力</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">金額</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            min={1}
            className="w-full px-3 py-2 border rounded-lg text-lg"
            placeholder="0"
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
            placeholder="例: スーパーでの買い物"
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

        {error && <p className="text-red-500 text-sm">{error}</p>}

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
