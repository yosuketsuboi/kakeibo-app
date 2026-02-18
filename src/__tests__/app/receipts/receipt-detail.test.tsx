import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

  it('shows mismatch warning when total and items sum differ', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '食パン', quantity: 2, unit_price: 150, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    // items total = 200 + 300 = 500, receipt total = 1000
    expect(await screen.findByText('⚠ 合計金額と明細の合計が一致しません')).toBeInTheDocument()
    expect(screen.getByText(/差額/)).toBeInTheDocument()
  })

  it('does not show mismatch warning when total and items sum match', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '食パン', quantity: 2, unit_price: 150, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('テストスーパー')
    expect(screen.queryByText('⚠ 合計金額と明細の合計が一致しません')).not.toBeInTheDocument()
  })

  it('does not show mismatch warning when no items exist', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('テストスーパー')
    expect(screen.queryByText('⚠ 合計金額と明細の合計が一致しません')).not.toBeInTheDocument()
  })

  it('does not show mismatch warning when total is 0 or empty', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: null,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('テストスーパー')
    expect(screen.queryByText('⚠ 合計金額と明細の合計が一致しません')).not.toBeInTheDocument()
  })

  it('does not show mismatch warning during processing', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'processing',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByText('OCR処理中...')
    expect(screen.queryByText('⚠ 合計金額と明細の合計が一致しません')).not.toBeInTheDocument()
  })

  it('shows category subtotals grouped by category', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '食パン', quantity: 2, unit_price: 150, category_id: 'cat-1' },
      { id: 'item-3', name: '洗剤', quantity: 1, unit_price: 300, category_id: 'cat-2' },
    ])

    render(<ReceiptDetailPage />)

    const heading = await screen.findByText('カテゴリ別小計')
    const section = heading.closest('div.mb-6')!
    // 食費: 200 + 300 = 500, 日用品: 300
    expect(section).toHaveTextContent('食費')
    expect(section).toHaveTextContent('¥500')
    expect(section).toHaveTextContent('日用品')
    expect(section).toHaveTextContent('¥300')
  })

  it('shows uncategorized subtotal for items without category', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '不明な品', quantity: 1, unit_price: 300, category_id: null },
    ])

    render(<ReceiptDetailPage />)

    const heading = await screen.findByText('カテゴリ別小計')
    const section = heading.closest('div.mb-6')!
    expect(section).toHaveTextContent('未分類')
    expect(section).toHaveTextContent('¥300')
  })

  it('does not show category subtotals when no items', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('テストスーパー')
    expect(screen.queryByText('カテゴリ別小計')).not.toBeInTheDocument()
  })

  it('does not show category subtotals during processing', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: null,
      total_amount: null,
      purchased_at: null,
      ocr_status: 'processing',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByText('OCR処理中...')
    expect(screen.queryByText('カテゴリ別小計')).not.toBeInTheDocument()
  })

  it('sorts category subtotals by amount descending', async () => {
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 1000,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '洗剤', quantity: 1, unit_price: 800, category_id: 'cat-2' },
      { id: 'item-2', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByText('カテゴリ別小計')
    const subtotalSection = screen.getByText('カテゴリ別小計').closest('div.mb-6')!
    const buttons = subtotalSection.querySelectorAll('button.flex')
    const categoryNames = Array.from(buttons)
      .map((el) => el.querySelector('.flex.items-center.gap-2 span:last-child')?.textContent)

    // 日用品(800) should come before 食費(200)
    expect(categoryNames).toEqual(['日用品', '食費'])
  })

  it('filters items when category subtotal is clicked', async () => {
    const user = userEvent.setup()
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 800,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '食パン', quantity: 2, unit_price: 150, category_id: 'cat-1' },
      { id: 'item-3', name: '洗剤', quantity: 1, unit_price: 300, category_id: 'cat-2' },
    ])

    render(<ReceiptDetailPage />)

    // Wait for load, all items visible
    await screen.findByDisplayValue('牛乳')
    expect(screen.getByDisplayValue('食パン')).toBeInTheDocument()
    expect(screen.getByDisplayValue('洗剤')).toBeInTheDocument()

    // Click 日用品 subtotal to filter
    const heading = screen.getByText('カテゴリ別小計')
    const section = heading.closest('div.mb-6')!
    const nichiyouhinBtn = within(section as HTMLElement).getByText('日用品').closest('button')!
    await user.click(nichiyouhinBtn)

    // Only 洗剤 should be visible
    expect(screen.getByDisplayValue('洗剤')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('牛乳')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('食パン')).not.toBeInTheDocument()
  })

  it('shows clear filter button when filtering and clears on click', async () => {
    const user = userEvent.setup()
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '洗剤', quantity: 1, unit_price: 300, category_id: 'cat-2' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('牛乳')

    // No clear button initially
    expect(screen.queryByText('フィルタ解除')).not.toBeInTheDocument()

    // Click 食費 subtotal
    const heading = screen.getByText('カテゴリ別小計')
    const section = heading.closest('div.mb-6')!
    const shokuhi = within(section as HTMLElement).getByText('食費').closest('button')!
    await user.click(shokuhi)

    // Clear button appears
    expect(screen.getByText('フィルタ解除')).toBeInTheDocument()
    expect(screen.getByDisplayValue('牛乳')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('洗剤')).not.toBeInTheDocument()

    // Click clear
    await user.click(screen.getByText('フィルタ解除'))

    // All items visible again
    expect(screen.getByDisplayValue('牛乳')).toBeInTheDocument()
    expect(screen.getByDisplayValue('洗剤')).toBeInTheDocument()
    expect(screen.queryByText('フィルタ解除')).not.toBeInTheDocument()
  })

  it('toggles filter off when same category is clicked again', async () => {
    const user = userEvent.setup()
    setupSupabaseMock({
      id: 'receipt-1',
      store_name: 'テストスーパー',
      total_amount: 500,
      purchased_at: '2026-01-15',
      ocr_status: 'done',
      image_path: 'household-1/test.jpg',
      ocr_raw: null,
    }, [
      { id: 'item-1', name: '牛乳', quantity: 1, unit_price: 200, category_id: 'cat-1' },
      { id: 'item-2', name: '洗剤', quantity: 1, unit_price: 300, category_id: 'cat-2' },
    ])

    render(<ReceiptDetailPage />)

    await screen.findByDisplayValue('牛乳')

    const heading = screen.getByText('カテゴリ別小計')
    const section = heading.closest('div.mb-6')!
    const shokuhi = within(section as HTMLElement).getByText('食費').closest('button')!

    // Click to filter
    await user.click(shokuhi)
    expect(screen.queryByDisplayValue('洗剤')).not.toBeInTheDocument()

    // Click same category again to unfilter
    await user.click(shokuhi)
    expect(screen.getByDisplayValue('牛乳')).toBeInTheDocument()
    expect(screen.getByDisplayValue('洗剤')).toBeInTheDocument()
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
