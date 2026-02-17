'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { formatCurrency, formatDate } from '@/lib/utils/format'
import Link from 'next/link'

type Receipt = {
  id: string
  store_name: string | null
  total_amount: number | null
  purchased_at: string | null
  ocr_status: string
  created_at: string
}

export default function ReceiptsPage() {
  const { household, loading: hhLoading } = useHousehold()
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!household) return
    loadReceipts()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household])

  async function loadReceipts() {
    if (!household) return
    const supabase = createClient()
    const { data } = await supabase
      .from('receipts')
      .select('id, store_name, total_amount, purchased_at, ocr_status, created_at')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
      .limit(50)

    setReceipts(data || [])
    setLoading(false)
  }

  if (hhLoading || loading) {
    return <div className="p-4 text-center text-gray-500">読み込み中...</div>
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">レシート一覧</h1>
        <Link
          href="/receipts/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          + 撮影
        </Link>
      </div>

      {receipts.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p>レシートがありません</p>
          <p className="text-sm mt-1">カメラで撮影して追加しましょう</p>
        </div>
      ) : (
        <div className="space-y-2">
          {receipts.map((receipt) => (
            <Link
              key={receipt.id}
              href={`/receipts/${receipt.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm border hover:bg-gray-50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    {receipt.store_name || '読み取り中...'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {receipt.purchased_at
                      ? formatDate(receipt.purchased_at)
                      : formatDate(receipt.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  {receipt.total_amount != null && (
                    <p className="font-bold">{formatCurrency(Number(receipt.total_amount))}</p>
                  )}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      receipt.ocr_status === 'done'
                        ? 'bg-green-100 text-green-700'
                        : receipt.ocr_status === 'error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {receipt.ocr_status === 'done' ? '完了' : receipt.ocr_status === 'error' ? 'エラー' : '処理中'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
