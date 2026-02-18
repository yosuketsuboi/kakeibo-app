import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockPush = vi.fn()
const mockRefresh = vi.fn()
const mockSignUp = vi.fn()
const mockRpc = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
  useSearchParams: () => ({
    get: vi.fn(() => null),
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { signUp: mockSignUp },
    rpc: mockRpc,
  }),
}))

import SignupPage from '@/app/signup/page'

describe('SignupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders signup form with all fields', () => {
    render(<SignupPage />)
    expect(screen.getByText('新規登録')).toBeInTheDocument()
    expect(screen.getByLabelText('メールアドレス')).toBeInTheDocument()
    expect(screen.getByLabelText('パスワード')).toBeInTheDocument()
    expect(screen.getByLabelText('世帯名（任意）')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '登録する' })).toBeInTheDocument()
  })

  it('renders link to login page', () => {
    render(<SignupPage />)
    const link = screen.getByText('ログイン')
    expect(link).toHaveAttribute('href', '/login')
  })

  it('submits form and calls rpc on success', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockRpc.mockResolvedValue({ data: 'household-id', error: null })
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.type(screen.getByLabelText('世帯名（任意）'), '田中家')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    })
    expect(mockRpc).toHaveBeenCalledWith('create_household_for_user', {
      p_household_name: '田中家',
    })
    expect(mockPush).toHaveBeenCalledWith('/dashboard')
  })

  it('uses email-based default name when household name is empty', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockRpc.mockResolvedValue({ data: 'household-id', error: null })
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(mockRpc).toHaveBeenCalledWith('create_household_for_user', {
      p_household_name: 'test@example.comの家計簿',
    })
  })

  it('displays error on auth failure', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already registered' },
    })
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('Email already registered')).toBeInTheDocument()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('displays error when user is null after signup', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('登録に失敗しました')).toBeInTheDocument()
  })

  it('displays error when rpc fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    })
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'RLS violation' },
    })
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(await screen.findByText('世帯の作成に失敗しました')).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disables button while loading', async () => {
    mockSignUp.mockReturnValue(new Promise(() => {}))
    const user = userEvent.setup()

    render(<SignupPage />)

    await user.type(screen.getByLabelText('メールアドレス'), 'test@example.com')
    await user.type(screen.getByLabelText('パスワード'), 'password123')
    await user.click(screen.getByRole('button', { name: '登録する' }))

    expect(screen.getByRole('button', { name: '登録中...' })).toBeDisabled()
  })
})
