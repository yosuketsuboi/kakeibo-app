import { describe, it, expect } from 'vitest'
import { config } from '@/middleware'

describe('middleware config', () => {
  // Next.js matcher uses negative lookahead from the second character onward.
  // The pattern: /((?!_next/static|_next/image|favicon.ico|manifest.json|icons/|sw.js).*)
  // It matches "/<anything>" unless the part after "/" starts with the excluded prefixes.
  // We test by simulating Next.js matching: strip leading "/" then check the lookahead.
  const pattern = config.matcher[0]
  // Extract the inner negative lookahead pattern
  const innerPattern = /\(\?!([^)]+)\)/.exec(pattern)?.[1] || ''
  const excludedPrefixes = innerPattern.split('|')

  function isExcluded(pathname: string): boolean {
    const withoutSlash = pathname.slice(1) // remove leading /
    return excludedPrefixes.some((prefix) => withoutSlash.startsWith(prefix))
  }

  it('has a matcher pattern defined', () => {
    expect(config.matcher).toHaveLength(1)
    expect(typeof config.matcher[0]).toBe('string')
  })

  it('does not exclude /dashboard', () => {
    expect(isExcluded('/dashboard')).toBe(false)
  })

  it('does not exclude /login', () => {
    expect(isExcluded('/login')).toBe(false)
  })

  it('does not exclude /receipts/new', () => {
    expect(isExcluded('/receipts/new')).toBe(false)
  })

  it('excludes /_next/static paths', () => {
    expect(isExcluded('/_next/static/chunks/main.js')).toBe(true)
  })

  it('excludes /_next/image paths', () => {
    expect(isExcluded('/_next/image')).toBe(true)
  })

  it('excludes /favicon.ico', () => {
    expect(isExcluded('/favicon.ico')).toBe(true)
  })

  it('excludes /manifest.json', () => {
    expect(isExcluded('/manifest.json')).toBe(true)
  })

  it('excludes /icons/ paths', () => {
    expect(isExcluded('/icons/icon-192.png')).toBe(true)
  })

  it('excludes /sw.js', () => {
    expect(isExcluded('/sw.js')).toBe(true)
  })
})
