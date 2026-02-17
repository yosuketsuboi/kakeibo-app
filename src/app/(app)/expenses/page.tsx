'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { formatCurrency, formatDate, formatMonth, getMonthLabel } from '@/lib/utils/format'
import Link from 'next/link'

type Expense = {
  id: string
  type: 'receipt' | 'manual'
  description: string
  amount: number
  date: string
  category_name: string | null
  category_color: string | null
}

export default function ExpensesPage() {
  const { household, categories, loading: hhLoading } = useHousehold()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [currentMonth, setCurrentMonth] = useState(formatMonth(new Date()))
  const [filterCategory, setFilterCategory] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    loadExpenses()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, currentMonth, filterCategory])

  async function loadExpenses() {
    if (!household) return
    setLoading(true)
    const supabase = createClient()

    const [year, month] = currentMonth.split('-').map(Number)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    const allExpenses: Expense[] = []

    // Get receipts
    const { data: receipts } = await supabase
      .from('receipts')
      .select('id, store_name, total_amount, purchased_at')
      .eq('household_id', household.id)
      .gte('purchased_at', startDate)
      .lt('purchased_at', endDate)
      .order('purchased_at', { ascending: false })

    receipts?.forEach((r) => {
      allExpenses.push({
        id: r.id,
        type: 'receipt',
        description: r.store_name || 'レシート',
        amount: Number(r.total_amount) || 0,
        date: r.purchased_at || '',
        category_name: null,
        category_color: null,
      })
    })

    // Get manual expenses
    let manualQuery = supabase
      .from('manual_expenses')
      .select('id, amount, description, expense_date, category_id')
      .eq('household_id', household.id)
      .gte('expense_date', startDate)
      .lt('expense_date', endDate)

    if (filterCategory) {
      manualQuery = manualQuery.eq('category_id', filterCategory)
    }

    const { data: manualExpenses } = await manualQuery.order('expense_date', { ascending: false })

    manualExpenses?.forEach((e) => {
      const cat = categories.find((c) => c.id === e.category_id)
      allExpenses.push({
        id: e.id,
        type: 'manual',
        description: e.description,
        amount: Number(e.amount),
        date: e.expense_date,
        category_name: cat?.name || null,
        category_color: cat?.color || null,
      })
    })

    // Sort by date descending
    allExpenses.sort((a, b) => b.date.localeCompare(a.date))
    setExpenses(allExpenses)
    setLoading(false)
  }

  function changeMonth(delta: number) {
    const [year, month] = currentMonth.split('-').map(Number)
    const d = new Date(year, month - 1 + delta, 1)
    setCurrentMonth(formatMonth(d))
  }

  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0)

  if (hhLoading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Month selector */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => changeMonth(-1)} className="p-2 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{getMonthLabel(currentMonth)}</h1>
        <button onClick={() => changeMonth(1)} className="p-2 text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {/* Total + actions */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-600">合計</p>
          <p className="text-xl font-bold">{loading ? '...' : formatCurrency(totalAmount)}</p>
        </div>
        <Link
          href="/expenses/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          + 手動入力
        </Link>
      </div>

      {/* Category filter */}
      <select
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        className="w-full px-3 py-2 border rounded-lg mb-4 text-sm"
      >
        <option value="">すべてのカテゴリ</option>
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>{cat.name}</option>
        ))}
      </select>

      {/* Expense list */}
      {loading ? (
        <div className="text-center text-gray-500 py-8">読み込み中...</div>
      ) : expenses.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>この月の支出がありません</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Link
              key={`${expense.type}-${expense.id}`}
              href={expense.type === 'receipt' ? `/receipts/${expense.id}` : `/expenses/${expense.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm border"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {expense.category_color && (
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: expense.category_color }}
                    />
                  )}
                  <div>
                    <p className="font-medium text-sm">{expense.description}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(expense.date)}
                      {expense.category_name && ` · ${expense.category_name}`}
                    </p>
                  </div>
                </div>
                <p className="font-bold">{formatCurrency(expense.amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
