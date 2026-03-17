'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { useParams, useRouter } from 'next/navigation'
import { formatCurrency, formatDate } from '@/lib/utils/format'

type ReceiptItem = {
  id: string
  name: string
  quantity: number
  unit_price: number
  category_id: string | null
}

type Receipt = {
  id: string
  store_name: string | null
  total_amount: number | null
  purchased_at: string | null
  payment_method_id: string | null
  ocr_status: string
  image_path: string
  ocr_raw: string | null
}

export default function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { household, categories, paymentMethods } = useHousehold()
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [items, setItems] = useState<ReceiptItem[]>([])
  const [storeName, setStoreName] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [purchasedAt, setPurchasedAt] = useState('')
  const [paymentMethodId, setPaymentMethodId] = useState('')
  const [saving, setSaving] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageLoading, setImageLoading] = useState(false)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null | undefined>(undefined)
  const [pendingScroll, setPendingScroll] = useState(false)
  const [isItemsHeaderVisible, setIsItemsHeaderVisible] = useState(true)
  const endOfItemsRef = useRef<HTMLDivElement>(null)
  const itemsHeaderRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    const el = itemsHeaderRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsItemsHeaderVisible(true)
        } else if (entry.boundingClientRect.top < 0) {
          // 上にスクロールアウトした場合のみフローティングボタンを表示
          setIsItemsHeaderVisible(false)
        }
        // 下方向（まだスクロール前）は無視
      },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [receipt])

  useEffect(() => {
    loadReceipt()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, household])

  async function loadReceipt() {
    if (!household) return
    const supabase = createClient()

    const { data: r } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', id)
      .single()

    if (!r) return

    setReceipt(r)
    setStoreName(r.store_name || '')
    setTotalAmount(r.total_amount?.toString() || '')
    setPurchasedAt(r.purchased_at || '')
    setPaymentMethodId(r.payment_method_id || '')

    // Load items
    const { data: itemsData } = await supabase
      .from('receipt_items')
      .select('*')
      .eq('receipt_id', id)
      .order('created_at')

    setItems(itemsData || [])

    // Get image URL
    const { data: urlData } = supabase.storage
      .from('receipts')
      .getPublicUrl(r.image_path)

    // For private buckets, use createSignedUrl instead
    const { data: signedData } = await supabase.storage
      .from('receipts')
      .createSignedUrl(r.image_path, 3600)

    setImageLoading(true)
    setImageUrl(signedData?.signedUrl || urlData.publicUrl)

    // If still processing, poll
    if (r.ocr_status === 'pending' || r.ocr_status === 'processing') {
      setTimeout(() => loadReceipt(), 3000)
    }
  }

  function updateItem(index: number, field: keyof ReceiptItem, value: string) {
    setItems((prev) => {
      const next = [...prev]
      if (field === 'quantity' || field === 'unit_price') {
        (next[index] as Record<string, unknown>)[field] = Number(value) || 0
      } else {
        (next[index] as Record<string, unknown>)[field] = value
      }
      return next
    })
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: '', quantity: 1, unit_price: 0, category_id: null },
    ])
    setPendingScroll(true)
  }

  useEffect(() => {
    if (pendingScroll) {
      endOfItemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setPendingScroll(false)
    }
  }, [pendingScroll, items])

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSave() {
    if (!receipt) return
    setSaving(true)

    const supabase = createClient()

    // Update receipt
    await supabase
      .from('receipts')
      .update({
        store_name: storeName,
        total_amount: Number(totalAmount) || null,
        purchased_at: purchasedAt || null,
        payment_method_id: paymentMethodId || null,
        ocr_status: 'done',
      })
      .eq('id', receipt.id)

    // Delete old items and insert new ones
    await supabase.from('receipt_items').delete().eq('receipt_id', receipt.id)

    if (items.length > 0) {
      await supabase.from('receipt_items').insert(
        items.map((item) => ({
          receipt_id: receipt.id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          category_id: item.category_id,
        }))
      )
    }

    setSaving(false)
    router.push('/receipts')
  }

  async function handleDelete() {
    if (!receipt || !confirm('このレシートを削除しますか？')) return
    const supabase = createClient()
    await supabase.from('receipts').delete().eq('id', receipt.id)
    router.push('/receipts')
  }

  if (!receipt) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  const isProcessing = receipt.ocr_status === 'pending' || receipt.ocr_status === 'processing'

  const itemsTotal = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const total = Number(totalAmount) || 0
  const hasMismatch = !isProcessing && items.length > 0 && total > 0 && itemsTotal !== total
  const mismatchDiff = itemsTotal - total

  return (
    <div className="max-w-lg mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">レシート詳細</h1>
        <button onClick={handleDelete} className="text-red-500 text-sm">
          削除
        </button>
      </div>

      {isProcessing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 text-center">
          <p className="text-yellow-700 text-sm">OCR処理中...</p>
        </div>
      )}

      {(() => {
        try {
          const raw = typeof receipt.ocr_raw === 'string' ? JSON.parse(receipt.ocr_raw) : receipt.ocr_raw
          return raw?._truncated
        } catch { return false }
      })() && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4">
          <p className="text-orange-700 text-sm font-medium">⚠ OCR結果が不完全です</p>
          <p className="text-orange-600 text-xs mt-1">
            明細が多いため一部の商品が読み取れなかった可能性があります。レシート画像を確認し、不足分を手動で追加してください。
          </p>
        </div>
      )}

      {hasMismatch && (
        <div className="sticky top-0 z-10 bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 shadow-sm">
          <p className="text-yellow-700 text-sm font-medium">⚠ 合計金額と明細の合計が一致しません</p>
          <p className="text-yellow-600 text-xs mt-1">
            合計金額: {formatCurrency(total)} / 明細合計: {formatCurrency(itemsTotal)}（差額: {mismatchDiff > 0 ? '+' : ''}{formatCurrency(mismatchDiff)}）
          </p>
        </div>
      )}

      {/* Receipt image */}
      {imageUrl && (
        <div className="relative w-full mb-4">
          {imageLoading && (
            <div className="w-full h-40 rounded-xl bg-gray-100 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <img
            src={imageUrl}
            alt="レシート画像"
            className={`w-full rounded-xl max-h-64 object-contain bg-gray-100 ${imageLoading ? 'hidden' : ''}`}
            onLoad={() => setImageLoading(false)}
            onError={() => setImageLoading(false)}
          />
        </div>
      )}

      {/* Receipt info */}
      <div className="space-y-3 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">店舗名</label>
          <input
            type="text"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="店舗名"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">合計金額</label>
          <input
            type="number"
            value={totalAmount}
            onChange={(e) => setTotalAmount(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="0"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">購入日</label>
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">支払方法</label>
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {paymentMethods.length === 0
                ? <option value="">現金</option>
                : <option value=""></option>
              }
              {paymentMethods.map((method) => (
                <option key={method.id} value={method.id}>{method.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Category subtotals */}
      {!isProcessing && items.length > 0 && (() => {
        const subtotals = new Map<string | null, number>()
        for (const item of items) {
          const key = item.category_id || null
          subtotals.set(key, (subtotals.get(key) || 0) + item.quantity * item.unit_price)
        }
        const entries = Array.from(subtotals.entries()).sort((a, b) => b[1] - a[1])
        return (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold">カテゴリ別小計</h2>
              {filterCategoryId !== undefined && (
                <button
                  onClick={() => setFilterCategoryId(undefined)}
                  className="text-blue-600 text-sm font-medium"
                >
                  フィルタ解除
                </button>
              )}
            </div>
            <div className="bg-gray-50 rounded-xl p-3 space-y-2">
              {entries.map(([catId, amount]) => {
                const cat = categories.find((c) => c.id === catId)
                const isActive = filterCategoryId !== undefined && filterCategoryId === (catId ?? null)
                return (
                  <button
                    key={catId ?? '_uncategorized'}
                    onClick={() => {
                      const key = catId ?? null
                      setFilterCategoryId(filterCategoryId === key ? undefined : key)
                    }}
                    className={`flex items-center justify-between text-sm w-full rounded-lg px-2 py-1 transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-gray-100'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat?.color || '#94a3b8' }}
                      />
                      <span>{cat?.name || '未分類'}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(amount)}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 mb-6"
      >
        {saving ? '保存中...' : '保存する'}
      </button>

      {/* Items */}
      <div className="mb-6">
        <div ref={itemsHeaderRef} className="flex items-center justify-between mb-2">
          <h2 className="font-semibold">明細</h2>
          <button onClick={addItem} className="text-blue-600 text-sm font-medium">
            + 追加
          </button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            {isProcessing ? 'OCR処理完了後に表示されます' : '明細がありません'}
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item, index) => {
              if (filterCategoryId !== undefined && (item.category_id || null) !== filterCategoryId) {
                return null
              }
              return (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2" ref={index === items.length - 1 ? endOfItemsRef : undefined}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="商品名"
                  />
                  <button
                    onClick={() => removeItem(index)}
                    className="text-red-400 text-sm px-2"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-2">
                  <div className="w-20">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                      min={1}
                    />
                  </div>
                  <div className="flex flex-1 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => updateItem(index, 'unit_price', String(-item.unit_price))}
                      className={`px-1.5 py-1 rounded border text-sm font-medium flex-shrink-0 ${item.unit_price < 0 ? 'bg-red-50 border-red-300 text-red-500' : 'border-gray-200 text-gray-400'}`}
                    >
                      −
                    </button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={Math.abs(item.unit_price) || ''}
                      onChange={(e) => {
                        const abs = Number(e.target.value) || 0
                        updateItem(index, 'unit_price', String(item.unit_price < 0 ? -abs : abs))
                      }}
                      className={`w-full px-2 py-1 border rounded text-sm ${item.unit_price < 0 ? 'text-red-500' : ''}`}
                      placeholder="単価"
                    />
                  </div>
                  <select
                    value={item.category_id || ''}
                    onChange={(e) => updateItem(index, 'category_id', e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                  >
                    <option value="">未分類</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={`text-right text-sm ${item.unit_price < 0 ? 'text-red-500' : 'text-gray-600'}`}>
                  小計: {formatCurrency(item.quantity * item.unit_price)}
                </div>
              </div>
              )
            })}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '保存中...' : '保存する'}
      </button>

      {/* Fixed add link — visible only when items header is scrolled out of view */}
      {!isItemsHeaderVisible && (
        <button
          onClick={addItem}
          className="fixed bottom-[5.5rem] right-4 z-20 text-blue-600 text-sm font-medium bg-white border border-blue-100 rounded-lg px-3 py-1.5 shadow-sm active:opacity-70"
        >
          + 追加
        </button>
      )}
    </div>
  )
}
