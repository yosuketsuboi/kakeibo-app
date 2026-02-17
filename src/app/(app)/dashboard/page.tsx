'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { formatCurrency, formatMonth, getMonthLabel } from '@/lib/utils/format'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

type ExpenseByCategory = {
  name: string
  color: string
  amount: number
}

export default function DashboardPage() {
  const { household, categories, loading: hhLoading } = useHousehold()
  const [currentMonth, setCurrentMonth] = useState(formatMonth(new Date()))
  const [categoryExpenses, setCategoryExpenses] = useState<ExpenseByCategory[]>([])
  const [monthlyTrend, setMonthlyTrend] = useState<{ month: string; amount: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, currentMonth])

  async function loadData() {
    if (!household) return
    setLoading(true)
    const supabase = createClient()

    const [year, month] = currentMonth.split('-').map(Number)
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, '0')}-01`

    // Get receipt items with categories for this month
    const { data: receipts } = await supabase
      .from('receipts')
      .select('id, total_amount, purchased_at, receipt_items(unit_price, quantity, category_id)')
      .eq('household_id', household.id)
      .gte('purchased_at', startDate)
      .lt('purchased_at', endDate)

    // Get manual expenses for this month
    const { data: manualExpenses } = await supabase
      .from('manual_expenses')
      .select('amount, category_id')
      .eq('household_id', household.id)
      .gte('expense_date', startDate)
      .lt('expense_date', endDate)

    // Aggregate by category
    const catMap = new Map<string, number>()
    receipts?.forEach((r) => {
      (r.receipt_items as { unit_price: number; quantity: number; category_id: string | null }[])?.forEach((item) => {
        const catId = item.category_id || 'uncategorized'
        catMap.set(catId, (catMap.get(catId) || 0) + item.unit_price * item.quantity)
      })
    })
    manualExpenses?.forEach((e) => {
      const catId = e.category_id || 'uncategorized'
      catMap.set(catId, (catMap.get(catId) || 0) + Number(e.amount))
    })

    const catData: ExpenseByCategory[] = []
    catMap.forEach((amount, catId) => {
      const cat = categories.find((c) => c.id === catId)
      catData.push({
        name: cat?.name || 'その他',
        color: cat?.color || '#94a3b8',
        amount,
      })
    })
    catData.sort((a, b) => b.amount - a.amount)
    setCategoryExpenses(catData)

    // Monthly trend (last 6 months)
    const trend: { month: string; amount: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1)
      const mStart = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
      const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      const mEnd = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`

      const { data: mReceipts } = await supabase
        .from('receipts')
        .select('total_amount')
        .eq('household_id', household.id)
        .gte('purchased_at', mStart)
        .lt('purchased_at', mEnd)

      const { data: mManual } = await supabase
        .from('manual_expenses')
        .select('amount')
        .eq('household_id', household.id)
        .gte('expense_date', mStart)
        .lt('expense_date', mEnd)

      const total =
        (mReceipts?.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0) || 0) +
        (mManual?.reduce((sum, e) => sum + Number(e.amount), 0) || 0)

      trend.push({
        month: `${d.getMonth() + 1}月`,
        amount: total,
      })
    }
    setMonthlyTrend(trend)
    setLoading(false)
  }

  const totalAmount = useMemo(
    () => categoryExpenses.reduce((sum, c) => sum + c.amount, 0),
    [categoryExpenses]
  )

  function changeMonth(delta: number) {
    const [year, month] = currentMonth.split('-').map(Number)
    const d = new Date(year, month - 1 + delta, 1)
    setCurrentMonth(formatMonth(d))
  }

  if (hhLoading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  if (!household) {
    return <div className="p-4 text-center text-gray-500">世帯が見つかりません</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      {/* Month selector */}
      <div className="flex items-center justify-between mb-6">
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

      {/* Total */}
      <div className="bg-blue-50 rounded-2xl p-4 mb-6 text-center">
        <p className="text-sm text-gray-600">合計支出</p>
        <p className="text-3xl font-bold text-blue-700">
          {loading ? '...' : formatCurrency(totalAmount)}
        </p>
      </div>

      {/* Pie chart */}
      {!loading && categoryExpenses.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border">
          <h2 className="text-sm font-semibold mb-2 text-gray-700">カテゴリ別内訳</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={categoryExpenses}
                dataKey="amount"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ name, percent }) =>
                  `${name ?? ''} ${(((percent as number) ?? 0) * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {categoryExpenses.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>

          {/* Category list */}
          <div className="mt-2 space-y-1">
            {categoryExpenses.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span>{cat.name}</span>
                </div>
                <span className="font-medium">{formatCurrency(cat.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bar chart - monthly trend */}
      {!loading && monthlyTrend.length > 0 && (
        <div className="bg-white rounded-2xl p-4 mb-6 shadow-sm border">
          <h2 className="text-sm font-semibold mb-2 text-gray-700">月別推移</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!loading && categoryExpenses.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <p>この月のデータがありません</p>
          <p className="text-sm mt-1">レシートを撮影するか、手動で支出を入力しましょう</p>
        </div>
      )}
    </div>
  )
}
