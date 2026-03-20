import { describe, it, expect } from 'vitest'
import { SURFACE_COLORS, getSurfaceColor } from './colors'

describe('SURFACE_COLORS', () => {
  it('has 4 colors', () => {
    expect(SURFACE_COLORS).toHaveLength(4)
  })
})

describe('getSurfaceColor', () => {
  it('returns blue for index 0', () => {
    expect(getSurfaceColor(0)).toBe('#4a9eff')
  })

  it('returns red for index 1', () => {
    expect(getSurfaceColor(1)).toBe('#ff6b6b')
  })

  it('returns yellow for index 2', () => {
    expect(getSurfaceColor(2)).toBe('#ffd93d')
  })

  it('returns green for index 3', () => {
    expect(getSurfaceColor(3)).toBe('#6bcb77')
  })

  it('wraps around for out-of-range index', () => {
    expect(getSurfaceColor(4)).toBe('#4a9eff')
  })
})
