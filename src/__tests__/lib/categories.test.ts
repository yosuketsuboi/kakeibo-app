import { describe, it, expect } from 'vitest'
import { DEFAULT_CATEGORIES } from '@/lib/categories'

describe('DEFAULT_CATEGORIES', () => {
  it('has 15 categories', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(15)
  })

  it('has unique names', () => {
    const names = DEFAULT_CATEGORIES.map((c) => c.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('has unique sort_order values', () => {
    const orders = DEFAULT_CATEGORIES.map((c) => c.sort_order)
    expect(new Set(orders).size).toBe(orders.length)
  })

  it('sort_order starts at 1 and is sequential', () => {
    const orders = DEFAULT_CATEGORIES.map((c) => c.sort_order)
    expect(orders).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
  })

  it('all colors are valid hex colors', () => {
    DEFAULT_CATEGORIES.forEach((cat) => {
      expect(cat.color).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('has unique colors', () => {
    const colors = DEFAULT_CATEGORIES.map((c) => c.color)
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('first category is 食費', () => {
    expect(DEFAULT_CATEGORIES[0].name).toBe('食費')
  })

  it('last category is その他', () => {
    expect(DEFAULT_CATEGORIES[14].name).toBe('その他')
  })

  it('each category has name, color, and sort_order', () => {
    DEFAULT_CATEGORIES.forEach((cat) => {
      expect(cat).toHaveProperty('name')
      expect(cat).toHaveProperty('color')
      expect(cat).toHaveProperty('sort_order')
      expect(typeof cat.name).toBe('string')
      expect(typeof cat.color).toBe('string')
      expect(typeof cat.sort_order).toBe('number')
    })
  })
})
