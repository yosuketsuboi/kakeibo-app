import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockPush = vi.fn()
const mockParams = { id: 'receipt-1' }

const mockFrom = vi.fn()
const mockStorage = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => mockParams,
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
    storage: { from: mockStorage },
  }),
}))

vi.mock('@/lib/hooks/useHousehold', () => ({
  useHousehold: () => ({
    household: { id: 'household-1', name: 'テスト家' },
    categories: [
      { id: 'cat-1', name: '食費', color: '#ef4444', sort_order: 1 },
      { id: 'cat-2', name: '日用品', color: '#f97316', sort_order: 3 },
    ],
  }),
}))

vi.mock('@/lib/utils/format', () => ({
  formatCurrency: (n: number) => `¥${n.toLocaleString()}`,
  formatDate: (d: string) => d,
}))

import ReceiptDetailPage from '@/app/(app)/receipts/[id]/page'

function setupSupabaseMock(receipt: Record<string, unknown>, items: Record<string, unknown>[] = []) {
  // Mock supabase.from('receipts').select('*').eq('id', ...).single()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'receipts') {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: receipt, error: null }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    }
    if (table === 'receipt_items') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: items, error: null }),
          }),
        }),
        insert: () => Promise.resolve({ error: null }),
        delete: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      }
    }
    return {}
  })

  // Mock storage
  mockStorage.mockReturnValue({
    getPublicUrl: () => ({ data: { publicUrl: 'https://example.com/receipt.jpg' } }),
    createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://example.com/signed.jpg' } }),
  })
}

describe('ReceiptDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially when receipt is null', () => {
    // Don't resolve the supabase call
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () => new Promise(() => {}),
        }),
      }),
    })
    mockStorage.mockReturnValue({
      getPublicUrl: () => ({ data: { publicUrl: '' } }),
      createSignedUrl: () => new Promise(() => {}),
    })

    render(<ReceiptDetailPage />)
    expect(screen.getByText('読み込み中...')).toBeInTheDocument()
  })

  it('shows truncation warning when ocr_raw._truncated is true', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: JSON.stringify({ _truncated: true, store_name: 'テストスーパー', items: [] }),
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    expect(await screen.findByText('⚠ OCR結果が不完全です')).toBeInTheDocument()
    expect(screen.getByText(/明細が多いため一部の商品が読み取れなかった可能性があります/)).toBeInTheDocument()
  })

  it('does not show truncation warning when ocr_raw._truncated is absent', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: JSON.stringify({ store_name: 'テストスーパー', items: [] }),
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    // Wait for receipt to load
    await screen.findByDisplayValue('テストスーパー')
    expect(screen.queryByText('⚠ OCR結果が不完全です')).not.toBeInTheDocument()
  })

  it('does not show truncation warning when ocr_raw is null', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: null,
      total_amount: null,
      purchased_at: null,
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    })

    render(<ReceiptDetailPage />)

    await screen.findByText('レシート詳細')
    expect(screen.queryByText('⚠ OCR結果が不完全です')).not.toBeInTheDocument()
  })

  it('shows processing banner when ocr_status is processing', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: null,
      total_amount: null,
      purchased_at: null,
      ocr_status: 'processing',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    })

    render(<ReceiptDetailPage />)

    expect(await screen.findByText('OCR処理中...')).toBeInTheDocument()
  })

  it('renders receipt details correctly after loading', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: JSON.stringify({ store_name: 'テストスーパー', items: [] }),
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '食パン', quantity: 2, unit_price: 150, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    expect(await screen.findByDisplayValue('テストスーパー')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1500')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-01-15')).toBeInTheDocument()
    expect(screen.getByDisplayValue('牛乳')).toBeInTheDocument()
    expect(screen.getByDisplayValue('食パン')).toBeInTheDocument()
  })

  it('shows both processing and truncation warnings when applicable', async () => {
    // Edge case: status is done but truncated
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: JSON.stringify({ _truncated: true, store_name: 'テストスーパー', items: [] }),
    })

    render(<ReceiptDetailPage />)

    expect(await screen.findByText('⚠ OCR結果が不完全です')).toBeInTheDocument()
    // Processing banner should NOT show when status is done
    expect(screen.queryByText('OCR処理中...')).not.toBeInTheDocument()
  })
})
