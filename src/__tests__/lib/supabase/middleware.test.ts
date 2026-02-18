import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('next/server', async () => {
  return {
    NextResponse: {
      next: vi.fn(() => ({
        type: 'next',
        cookies: {
          set: vi.fn(),
        },
      })),
      redirect: vi.fn((url: { pathname: string }) => ({
        type: 'redirect',
        pathname: url.pathname,
      })),
    },
  }
})

import { updateSession } from '@/lib/supabase/middleware'
import { NextResponse } from 'next/server'

function createMockRequest(pathname: string) {
  const url = new URL(`http://localhost:3000${pathname}`)
  return {
    nextUrl: {
      pathname,
      clone: () => {
        const cloned = new URL(url.toString())
        return cloned
      },
    },
    cookies: {
      getAll: vi.fn(() => []),
      set: vi.fn(),
    },
  } as unknown as Parameters<typeof updateSession>[0]
}

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
  })

  it('redirects unauthenticated user to /login from protected route', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await updateSession(createMockRequest('/dashboard'))

    expect(NextResponse.redirect).toHaveBeenCalled()
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as URL
    expect(redirectArg.pathname).toBe('/login')
  })

  it('redirects unauthenticated user to /login from /settings', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await updateSession(createMockRequest('/settings'))

    expect(NextResponse.redirect).toHaveBeenCalled()
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as URL
    expect(redirectArg.pathname).toBe('/login')
  })

  it('allows unauthenticated user to access /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await updateSession(createMockRequest('/login'))

    expect(NextResponse.redirect).not.toHaveBeenCalled()
  })

  it('allows unauthenticated user to access /signup', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await updateSession(createMockRequest('/signup'))

    expect(NextResponse.redirect).not.toHaveBeenCalled()
  })

  it('allows unauthenticated user to access /invite', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    await updateSession(createMockRequest('/invite'))

    expect(NextResponse.redirect).not.toHaveBeenCalled()
  })

  it('redirects authenticated user from /login to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await updateSession(createMockRequest('/login'))

    expect(NextResponse.redirect).toHaveBeenCalled()
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as URL
    expect(redirectArg.pathname).toBe('/dashboard')
  })

  it('redirects authenticated user from /signup to /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await updateSession(createMockRequest('/signup'))

    expect(NextResponse.redirect).toHaveBeenCalled()
    const redirectArg = vi.mocked(NextResponse.redirect).mock.calls[0][0] as URL
    expect(redirectArg.pathname).toBe('/dashboard')
  })

  it('allows authenticated user to access /dashboard', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await updateSession(createMockRequest('/dashboard'))

    expect(NextResponse.redirect).not.toHaveBeenCalled()
  })

  it('allows authenticated user to access /receipts', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    await updateSession(createMockRequest('/receipts'))

    expect(NextResponse.redirect).not.toHaveBeenCalled()
  })
})
