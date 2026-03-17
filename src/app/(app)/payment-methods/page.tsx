'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import type { Tables } from '@/lib/types/database'

export default function PaymentMethodsPage() {
  const { household, refreshPaymentMethods } = useHousehold()
  const [methods, setMethods] = useState<Tables<'payment_methods'>[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    loadMethods()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function loadMethods() {
    if (!household) return
    const supabase = createClient()
    const { data } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('household_id', household.id)
      .order('sort_order')

    setMethods(data || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!household || !newName.trim()) return

    const supabase = createClient()
    await supabase.from('payment_methods').insert({
      household_id: household.id,
      name: newName.trim(),
      color: newColor,
      sort_order: methods.length + 1,
    })

    setNewName('')
    setNewColor('#94a3b8')
    await Promise.all([loadMethods(), refreshPaymentMethods()])
  }

  async function handleUpdate(id: string) {
    const supabase = createClient()
    await supabase
      .from('payment_methods')
      .update({ name: editName, color: editColor })
      .eq('id', id)

    setEditId(null)
    await Promise.all([loadMethods(), refreshPaymentMethods()])
  }

  async function handleDelete(id: string) {
    if (!confirm('この支払方法を削除しますか？関連する支出の支払方法は「現金」になります。')) return
    const supabase = createClient()
    await supabase.from('payment_methods').delete().eq('id', id)
    await Promise.all([loadMethods(), refreshPaymentMethods()])
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">支払方法管理</h1>

      {/* Add form */}
      <form onSubmit={handleAdd} className="flex gap-2 mb-6">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-10 h-10 rounded border cursor-pointer"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="新しい支払方法"
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          追加
        </button>
      </form>

      {/* Payment methods list */}
      <div className="space-y-2">
        {methods.map((method) => (
          <div key={method.id} className="bg-white rounded-xl p-3 shadow-sm border">
            {editId === method.id ? (
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={editColor}
                  onChange={(e) => setEditColor(e.target.value)}
                  className="w-8 h-8 rounded border cursor-pointer"
                />
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 px-2 py-1 border rounded text-sm"
                />
                <button
                  onClick={() => handleUpdate(method.id)}
                  className="text-blue-600 text-sm font-medium"
                >
                  保存
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="text-gray-500 text-sm"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: method.color }}
                  />
                  <span className="font-medium text-sm">{method.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditId(method.id)
                      setEditName(method.name)
                      setEditColor(method.color)
                    }}
                    className="text-blue-600 text-sm"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(method.id)}
                    className="text-red-500 text-sm"
                  >
                    削除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
