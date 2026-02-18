import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/dashboard'),
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import BottomNav from '@/components/BottomNav'
import { usePathname } from 'next/navigation'

describe('BottomNav', () => {
  it('renders all navigation items', () => {
    render(<BottomNav />)
    expect(screen.getByText('ホーム')).toBeInTheDocument()
    expect(screen.getByText('レシート')).toBeInTheDocument()
    expect(screen.getByText('支出')).toBeInTheDocument()
    expect(screen.getByText('設定')).toBeInTheDocument()
  })

  it('does not render label for camera (highlight) item', () => {
    render(<BottomNav />)
    expect(screen.queryByText('撮影')).not.toBeInTheDocument()
  })

  it('renders correct links', () => {
    render(<BottomNav />)
    const links = screen.getAllByRole('link')
    const hrefs = links.map((link) => link.getAttribute('href'))
    expect(hrefs).toContain('/dashboard')
    expect(hrefs).toContain('/receipts')
    expect(hrefs).toContain('/receipts/new')
    expect(hrefs).toContain('/expenses')
    expect(hrefs).toContain('/settings')
  })

  it('has 5 navigation links', () => {
    render(<BottomNav />)
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(5)
  })

  it('highlights active nav item based on pathname', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    render(<BottomNav />)

    const dashboardLink = screen.getByText('ホーム').closest('a')
    expect(dashboardLink?.className).toContain('text-blue-600')
  })

  it('does not highlight inactive nav items', () => {
    vi.mocked(usePathname).mockReturnValue('/dashboard')
    render(<BottomNav />)

    const settingsLink = screen.getByText('設定').closest('a')
    expect(settingsLink?.className).toContain('text-gray-500')
  })

  it('highlights receipts when on /receipts sub-path', () => {
    vi.mocked(usePathname).mockReturnValue('/receipts/abc-123')
    render(<BottomNav />)

    const receiptsLink = screen.getByText('レシート').closest('a')
    expect(receiptsLink?.className).toContain('text-blue-600')
  })
})
