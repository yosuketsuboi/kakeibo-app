'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import type { Tables } from '@/lib/types/database'

export default function CategoriesPage() {
  const { household } = useHousehold()
  const [categories, setCategories] = useState<Tables<'categories'>[]>([])
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#94a3b8')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    loadCategories()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function loadCategories() {
    if (!household) return
    const supabase = createClient()
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('household_id', household.id)
      .order('sort_order')

    setCategories(data || [])
    setLoading(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!household || !newName.trim()) return

    const supabase = createClient()
    await supabase.from('categories').insert({
      household_id: household.id,
      name: newName.trim(),
      color: newColor,
      sort_order: categories.length + 1,
    })

    setNewName('')
    setNewColor('#94a3b8')
    loadCategories()
  }

  async function handleUpdate(id: string) {
    const supabase = createClient()
    await supabase
      .from('categories')
      .update({ name: editName, color: editColor })
      .eq('id', id)

    setEditId(null)
    loadCategories()
  }

  async function handleDelete(id: string) {
    if (!confirm('このカテゴリを削除しますか？関連する支出のカテゴリは「未分類」になります。')) return
    const supabase = createClient()
    await supabase.from('categories').delete().eq('id', id)
    loadCategories()
  }

  if (loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">カテゴリ管理</h1>

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
          placeholder="新しいカテゴリ名"
          className="flex-1 px-3 py-2 border rounded-lg"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          追加
        </button>
      </form>

      {/* Category list */}
      <div className="space-y-2">
        {categories.map((cat) => (
          <div key={cat.id} className="bg-white rounded-xl p-3 shadow-sm border">
            {editId === cat.id ? (
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
                  onClick={() => handleUpdate(cat.id)}
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
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-sm">{cat.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditId(cat.id)
                      setEditName(cat.name)
                      setEditColor(cat.color)
                    }}
                    className="text-blue-600 text-sm"
                  >
                    編集
                  </button>
                  <button
                    onClick={() => handleDelete(cat.id)}
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
