'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useHousehold } from '@/lib/hooks/useHousehold'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'

export default function NewReceiptPage() {
  const { household } = useHousehold()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const router = useRouter()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)

    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleUpload() {
    if (!selectedFile || !household) return

    setUploading(true)
    setStatus('画像を圧縮中...')

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('認証エラー')

      // Compress image
      const compressed = await imageCompression(selectedFile, {
        maxSizeMB: 0.8,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      })

      setStatus('アップロード中...')

      // Upload to Supabase Storage
      const fileName = `${household.id}/${Date.now()}_${compressed.name}`
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(fileName, compressed)

      if (uploadError) throw uploadError

      setStatus('レシートを登録中...')

      // Create receipt record
      const { data: receipt, error: receiptError } = await supabase
        .from('receipts')
        .insert({
          household_id: household.id,
          user_id: user.id,
          image_path: fileName,
          ocr_status: 'pending',
        })
        .select()
        .single()

      if (receiptError) throw receiptError

      setStatus('OCR処理を開始...')

      // Call Edge Function for OCR
      const { error: fnError } = await supabase.functions.invoke('process-receipt', {
        body: { receipt_id: receipt.id },
      })

      if (fnError) {
        console.error('OCR function error:', fnError)
        // Don't throw - receipt is saved, OCR can be retried
      }

      router.push(`/receipts/${receipt.id}`)
    } catch (err) {
      console.error(err)
      setStatus('エラーが発生しました')
      setUploading(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold mb-4">レシート撮影</h1>

      {!preview ? (
        <div className="space-y-4">
          {/* Camera capture */}
          <label className="block w-full aspect-[3/4] bg-gray-100 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-gray-50">
            <div className="text-center">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mx-auto text-gray-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <p className="mt-2 text-sm text-gray-500">タップしてレシートを撮影</p>
              <p className="text-xs text-gray-400">またはギャラリーから選択</p>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Preview */}
          <div className="relative">
            <img
              src={preview}
              alt="レシートプレビュー"
              className="w-full rounded-2xl"
            />
            <button
              onClick={() => {
                setPreview(null)
                setSelectedFile(null)
              }}
              className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? status : 'アップロードして読み取り'}
          </button>
        </div>
      )}
    </div>
  )
}
