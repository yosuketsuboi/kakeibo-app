import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { type ReactNode } from 'react'
import { HouseholdContext, useHousehold } from '@/lib/hooks/useHousehold'

describe('useHousehold', () => {
  it('returns default context values', () => {
    const { result } = renderHook(() => useHousehold())
    expect(result.current.household).toBeNull()
    expect(result.current.categories).toEqual([])
    expect(result.current.loading).toBe(true)
  })

  it('returns provided context values', () => {
    const mockHousehold = {
      id: 'test-id',
      name: 'テスト家',
      created_at: '2026-01-01T00:00:00Z',
    }
    const mockCategories = [
      {
        id: 'cat-1',
        household_id: 'test-id',
        name: '食費',
        color: '#ef4444',
        sort_order: 1,
        created_at: '2026-01-01T00:00:00Z',
      },
    ]

    const wrapper = ({ children }: { children: ReactNode }) => (
      <HouseholdContext.Provider
        value={{ household: mockHousehold, categories: mockCategories, loading: false }}
      >
        {children}
      </HouseholdContext.Provider>
    )

    const { result } = renderHook(() => useHousehold(), { wrapper })
    expect(result.current.household).toEqual(mockHousehold)
    expect(result.current.categories).toEqual(mockCategories)
    expect(result.current.loading).toBe(false)
  })
})
