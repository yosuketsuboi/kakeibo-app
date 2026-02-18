import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatMonth, getMonthLabel } from '@/lib/utils/format'

describe('formatCurrency', () => {
  it('formats positive integer as JPY', () => {
    expect(formatCurrency(1000)).toBe('￥1,000')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('￥0')
  })

  it('formats large amount with commas', () => {
    expect(formatCurrency(1234567)).toBe('￥1,234,567')
  })

  it('rounds decimal to integer (JPY has no decimals)', () => {
    // JPY rounds to nearest integer
    const result = formatCurrency(1234.5)
    expect(result).toBe('￥1,235')
  })

  it('formats negative amount', () => {
    const result = formatCurrency(-500)
    expect(result).toBe('-￥500')
  })
})

describe('formatDate', () => {
  it('formats ISO date string to Japanese format', () => {
    const result = formatDate('2026-01-15')
    expect(result).toBe('2026年1月15日')
  })

  it('formats date with single digit month and day', () => {
    const result = formatDate('2026-03-05')
    expect(result).toBe('2026年3月5日')
  })

  it('formats December date', () => {
    const result = formatDate('2025-12-31')
    expect(result).toBe('2025年12月31日')
  })
})

describe('formatMonth', () => {
  it('formats date to YYYY-MM string', () => {
    expect(formatMonth(new Date(2026, 0, 1))).toBe('2026-01')
  })

  it('pads single digit month with zero', () => {
    expect(formatMonth(new Date(2026, 2, 15))).toBe('2026-03')
  })

  it('formats December correctly', () => {
    expect(formatMonth(new Date(2025, 11, 31))).toBe('2025-12')
  })

  it('formats October (two digit month) correctly', () => {
    expect(formatMonth(new Date(2026, 9, 1))).toBe('2026-10')
  })
})

describe('getMonthLabel', () => {
  it('returns Japanese month label', () => {
    expect(getMonthLabel('2026-01')).toBe('2026年1月')
  })

  it('strips leading zero from month', () => {
    expect(getMonthLabel('2026-03')).toBe('2026年3月')
  })

  it('handles December', () => {
    expect(getMonthLabel('2025-12')).toBe('2025年12月')
  })

  it('handles October', () => {
    expect(getMonthLabel('2026-10')).toBe('2026年10月')
  })
})
